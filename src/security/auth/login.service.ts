// MODULE 4.3 — Login Service

import type { UsersRepository } from '../users/users.repository.js';
import type { SessionService } from '../session/session.service.js';
import type { SecurityEventsRepository } from '../risk/security-events.repository.js';
import { verifyPassword } from '../crypto/argon2.js';
import { InvalidCredentialsError, UnverifiedEmailError, HighRiskLoginError } from '../errors/index.js';
import { scoreIpReputation } from '../risk/scorers/ip-reputation.scorer.js';
import { scoreFailedAttempts } from '../risk/scorers/failed-attempts.scorer.js';
import { aggregate } from '../risk/risk.service.js';
import { fetchAbuseScore } from '../risk/ip-intelligence.js';

export interface LoginInput {
  username: string;
  password: string;
  ip: string;
  userAgent?: string;
}

function abuseToScore(score: number): number {
  if (score >= 80) return 100;
  if (score >= 50) return 60;
  if (score >= 20) return 30;
  return 0;
}

export class LoginService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly sessionService: SessionService,
    private readonly eventsRepo: SecurityEventsRepository,
  ) {}

  async login(input: LoginInput): Promise<string> {
    const normalized = input.username.toLowerCase();
    const user = await this.usersRepo.findByUsername(normalized);

    if (!user || user.deletedAt) throw new InvalidCredentialsError();
    if (!user.emailVerified) throw new UnverifiedEmailError();

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await this.eventsRepo.logEvent({
        userId: user.id,
        type: 'LOGIN_FAILED',
        ip: input.ip,
        userAgent: input.userAgent,
        riskLevel: 'LOW',
      });
      throw new InvalidCredentialsError();
    }

    // ── Risk scoring ──
    const [recentEvents, abuseScore] = await Promise.all([
      this.eventsRepo.getRecentEvents(user.id, 20),
      fetchAbuseScore(input.ip, process.env.ABUSEIPDB_API_KEY ?? ''),
    ]);

    const failedAttempts = recentEvents
      .filter((e) => e.eventType === 'LOGIN_FAILED')
      .map((e) => ({ timestamp: e.createdAt }));

    const ipScore = Math.max(scoreIpReputation(input.ip), abuseToScore(abuseScore));
    const failedScore = scoreFailedAttempts(failedAttempts);
    const { level, action } = aggregate([ipScore, failedScore]);

    if (action === 'LOCK_ACCOUNT') {
      await this.eventsRepo.logEvent({
        userId: user.id,
        type: 'LOGIN_BLOCKED',
        ip: input.ip,
        userAgent: input.userAgent,
        riskLevel: level,
        metadata: { ipScore, failedScore, action },
      });
      throw new HighRiskLoginError();
    }

    const sessionId = await this.sessionService.createSession({
      userId: user.id,
      username: user.username,
      authMethod: 'password',
    });

    await this.eventsRepo.logEvent({
      userId: user.id,
      type: 'LOGIN_SUCCESS',
      ip: input.ip,
      userAgent: input.userAgent,
      riskLevel: level,
      metadata: { action },
    });

    return sessionId;
  }
}

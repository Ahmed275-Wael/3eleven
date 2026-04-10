// MODULE 4.2 — Email Verification Service

import type Redis from 'ioredis';
import type { UsersRepository } from '../users/users.repository.js';
import type { SessionService } from '../session/session.service.js';
import type { EmailSender } from './registration.service.js';
import type { SecurityEventsRepository } from '../risk/security-events.repository.js';
import { consumeCode, generateCode } from '../crypto/verification-code.js';
import {
  InvalidVerificationCodeError,
  AlreadyVerifiedError,
  UserNotFoundError,
} from '../errors/index.js';

export interface VerifyEmailInput {
  email: string;
  code: string;
  ip?: string;
}

export class EmailVerificationService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly redis: Redis,
    private readonly sessionService: SessionService,
    private readonly emailSender: EmailSender,
    private readonly eventsRepo?: SecurityEventsRepository,
  ) {}

  async verifyEmail(input: VerifyEmailInput): Promise<string> {
    const user = await this.usersRepo.findByEmail(input.email);
    if (!user) throw new UserNotFoundError();
    if (user.emailVerified) throw new AlreadyVerifiedError();

    const valid = await consumeCode(this.redis, input.email, input.code);
    if (!valid) throw new InvalidVerificationCodeError();

    await this.usersRepo.setEmailVerified(user.id);

    // Log email verification event (best-effort)
    try {
      await this.eventsRepo?.logEvent({
        userId: user.id,
        type: 'EMAIL_VERIFIED',
        ip: input.ip ?? '0.0.0.0',
        riskLevel: 'LOW',
        metadata: { email: user.email },
      });
    } catch {
      // best-effort
    }

    const sessionId = await this.sessionService.createSession({
      userId: user.id,
      username: user.username,
      authMethod: 'password',
    });

    return sessionId;
  }

  async resendVerification(email: string, ip?: string): Promise<void> {
    const user = await this.usersRepo.findByEmail(email);
    if (!user) throw new UserNotFoundError();
    if (user.emailVerified) throw new AlreadyVerifiedError();

    const code = await generateCode(this.redis, email);
    try {
      await this.emailSender.sendVerificationCode(email, code);
    } catch {
      // best-effort — code is already stored in Redis
    }

    // Log resend event (best-effort)
    try {
      await this.eventsRepo?.logEvent({
        userId: user.id,
        type: 'RESEND_VERIFICATION',
        ip: ip ?? '0.0.0.0',
        riskLevel: 'LOW',
      });
    } catch {
      // best-effort
    }
  }
}

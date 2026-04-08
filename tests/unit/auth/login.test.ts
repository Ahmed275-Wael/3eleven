import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../../../src/security/routes/auth.routes.js';
import { LoginService, type LoginInput } from '../../../src/security/auth/login.service';
import {
  InvalidCredentialsError,
  UnverifiedEmailError,
  HighRiskLoginError,
} from '../../../src/security/errors';

// ---------------------------------------------------------------------------
// Mock argon2 verifyPassword
// ---------------------------------------------------------------------------
vi.mock('../../../src/security/crypto/argon2', () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
}));
import { verifyPassword } from '../../../src/security/crypto/argon2';

// Mock ip-intelligence so unit tests don't make real HTTP calls
vi.mock('../../../src/security/risk/ip-intelligence', () => ({
  fetchAbuseScore: vi.fn().mockResolvedValue(0),
}));
import { fetchAbuseScore } from '../../../src/security/risk/ip-intelligence';

function createMockUsersRepo(overrides: Record<string, any> = {}) {
  return {
    findByUsername: vi.fn().mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: 'user@test.com',
      passwordHash: '$argon2id$hashed',
      emailVerified: true,
      deletedAt: null,
    }),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    createUser: vi.fn(),
    setEmailVerified: vi.fn(),
    updatePasswordHash: vi.fn(),
    softDelete: vi.fn(),
    ...overrides,
  };
}

function createMockSessionService() {
  return {
    createSession: vi.fn().mockResolvedValue('session-id-abc'),
    getSession: vi.fn(),
    destroySession: vi.fn(),
    rotateSession: vi.fn(),
  };
}

function createMockEventsRepo() {
  return {
    logEvent: vi.fn().mockResolvedValue({
      id: 'evt-1',
      userId: 'user-1',
      eventType: 'LOGIN_SUCCESS',
      ipAddress: '127.0.0.1',
      userAgent: null,
      riskLevel: 'LOW',
      metadata: null,
      createdAt: new Date(),
    }),
    getRecentEvents: vi.fn().mockResolvedValue([]),
  };
}

// ---------------------------------------------------------------------------
// MODULE 4.3 — Login Service
// ---------------------------------------------------------------------------
describe('MODULE 4.3 — Login Service', () => {
  let service: LoginService;
  let usersRepo: ReturnType<typeof createMockUsersRepo>;
  let sessionService: ReturnType<typeof createMockSessionService>;
  let eventsRepo: ReturnType<typeof createMockEventsRepo>;

  const validInput: LoginInput = { username: 'testuser', password: 'securePass1!', ip: '127.0.0.1' };

  beforeEach(() => {
    vi.clearAllMocks();
    usersRepo = createMockUsersRepo();
    sessionService = createMockSessionService();
    eventsRepo = createMockEventsRepo();
    service = new LoginService(usersRepo as any, sessionService as any, eventsRepo as any);
  });

  it('login({ username, password, ip }) → findByUsername → verifyPassword → createSession → returns sessionId', async () => {
    const sessionId = await service.login(validInput);
    expect(usersRepo.findByUsername).toHaveBeenCalledWith('testuser');
    expect(verifyPassword).toHaveBeenCalledWith('securePass1!', '$argon2id$hashed');
    expect(sessionService.createSession).toHaveBeenCalled();
    expect(sessionId).toBe('session-id-abc');
  });

  it('successful login → logs LOGIN_SUCCESS event with correct ip', async () => {
    await service.login(validInput);
    expect(eventsRepo.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOGIN_SUCCESS', ip: '127.0.0.1' }),
    );
  });

  it('wrong username → throws InvalidCredentialsError (no user enumeration)', async () => {
    usersRepo.findByUsername.mockResolvedValueOnce(null);
    await expect(service.login(validInput)).rejects.toThrow(InvalidCredentialsError);
  });

  it('correct username, wrong password → logs LOGIN_FAILED → throws InvalidCredentialsError', async () => {
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);
    await expect(service.login(validInput)).rejects.toThrow(InvalidCredentialsError);
    expect(eventsRepo.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOGIN_FAILED' }),
    );
  });

  it('correct credentials → session created with { userId, username, authMethod: password }', async () => {
    await service.login(validInput);
    expect(sessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        username: 'testuser',
        authMethod: 'password',
      }),
    );
  });

  it('unverified user (emailVerified = false) → throws UnverifiedEmailError', async () => {
    usersRepo.findByUsername.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'user@test.com',
      passwordHash: '$argon2id$hashed',
      emailVerified: false,
      deletedAt: null,
    });
    await expect(service.login(validInput)).rejects.toThrow(UnverifiedEmailError);
  });

  it('soft-deleted user → throws InvalidCredentialsError (no enumeration)', async () => {
    usersRepo.findByUsername.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'user@test.com',
      passwordHash: '$argon2id$hashed',
      emailVerified: true,
      deletedAt: new Date(),
    });
    await expect(service.login(validInput)).rejects.toThrow(InvalidCredentialsError);
  });

  it('login is case-insensitive on username', async () => {
    await service.login({ ...validInput, username: 'TestUser' });
    expect(usersRepo.findByUsername).toHaveBeenCalledWith('testuser');
  });

  it('Tor exit node IP (score=100) → LOCK_ACCOUNT → logs LOGIN_BLOCKED → throws HighRiskLoginError', async () => {
    // 185.220.100.x is a known Tor prefix → scoreIpReputation returns 100
    // aggregate([100, 0]) = 100, with default critical=150 → HIGH (not CRITICAL)
    // Need aggregate >= 150 for LOCK_ACCOUNT; combine Tor IP (100) + 5 failed attempts (50) = 150
    eventsRepo.getRecentEvents.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, i) => ({
        id: `evt-${i}`,
        userId: 'user-1',
        eventType: 'LOGIN_FAILED',
        ipAddress: '185.220.100.1',
        userAgent: null,
        riskLevel: 'LOW',
        metadata: null,
        createdAt: new Date(Date.now() - i * 60_000), // within last 15min
      })),
    );
    await expect(
      service.login({ ...validInput, ip: '185.220.100.1' }),
    ).rejects.toThrow(HighRiskLoginError);
    expect(eventsRepo.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOGIN_BLOCKED' }),
    );
  });

  it('high AbuseIPDB score (≥80) + 5 recent failures → LOCK_ACCOUNT → throws HighRiskLoginError', async () => {
    vi.mocked(fetchAbuseScore).mockResolvedValueOnce(85); // maps to score 100
    eventsRepo.getRecentEvents.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, i) => ({
        id: `evt-${i}`,
        userId: 'user-1',
        eventType: 'LOGIN_FAILED',
        ipAddress: '1.2.3.4',
        userAgent: null,
        riskLevel: 'LOW',
        metadata: null,
        createdAt: new Date(Date.now() - i * 60_000),
      })),
    );
    await expect(service.login(validInput)).rejects.toThrow(HighRiskLoginError);
  });

  it('AbuseIPDB unavailable (score=0) + clean IP → LOW risk → login succeeds', async () => {
    vi.mocked(fetchAbuseScore).mockResolvedValueOnce(0);
    const sessionId = await service.login(validInput);
    expect(sessionId).toBe('session-id-abc');
  });
});

// ---------------------------------------------------------------------------
// MODULE 4.3 — Login Route
// ---------------------------------------------------------------------------
describe('MODULE 4.3 — Login Route', () => {
  let app: ReturnType<typeof Fastify>;
  let routeUsersRepo: ReturnType<typeof createMockUsersRepo>;
  let routeSessionService: ReturnType<typeof createMockSessionService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    routeUsersRepo = createMockUsersRepo();
    routeSessionService = {
      createSession: vi.fn().mockResolvedValue('route-session-id'),
      destroySession: vi.fn().mockResolvedValue(true),
      getSession: vi.fn(),
      rotateSession: vi.fn(),
    };
    app = Fastify();
    await app.register(cookie);
    app.decorate('usersRepo', routeUsersRepo);
    app.decorate('emailSender', { sendVerificationCode: vi.fn().mockResolvedValue(undefined) });
    app.decorate('resetEmailSender', { sendResetCode: vi.fn().mockResolvedValue(undefined) });
    app.decorate('sessionService', routeSessionService);
    app.decorate('eventsRepo', {
      logEvent: vi.fn().mockResolvedValue({ id: 'e1' }),
      getRecentEvents: vi.fn().mockResolvedValue([]),
    });
    await app.register(authRoutes);
    await app.ready();
  });

  afterEach(async () => app.close());

  it('POST /auth/login → { username, password } → 200 + Set-Cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'testuser', password: 'securePass1!' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /auth/login → unverified → 403 EMAIL_NOT_VERIFIED', async () => {
    routeUsersRepo.findByUsername.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'user@test.com',
      passwordHash: '$argon2id$hashed',
      emailVerified: false,
      deletedAt: null,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'testuser', password: 'securePass1!' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('EMAIL_NOT_VERIFIED');
  });

  it('POST /auth/login → wrong credentials → 401 INVALID_CREDENTIALS', async () => {
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'testuser', password: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/login → missing fields → 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /auth/logout → clears session + cookie → 200', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? '__session';
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { [cookieName]: 'route-session-id' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().loggedOut).toBe(true);
  });

  it('POST /auth/logout → no session cookie → still 200 (idempotent)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().loggedOut).toBe(false);
  });
});

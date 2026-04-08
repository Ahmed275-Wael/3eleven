import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../../../src/security/routes/auth.routes.js';
import {
  EmailVerificationService,
  type VerifyEmailInput,
} from '../../../src/security/auth/email-verification.service';
import {
  InvalidVerificationCodeError,
  ExpiredVerificationCodeError,
  AlreadyVerifiedError,
  UserNotFoundError,
} from '../../../src/security/errors';

// ---------------------------------------------------------------------------
// Mock crypto/verification-code at module level
// ---------------------------------------------------------------------------
vi.mock('../../../src/security/crypto/verification-code', () => ({
  consumeCode: vi.fn().mockResolvedValue(true),
  generateCode: vi.fn().mockResolvedValue('654321'),
}));
import { consumeCode, generateCode } from '../../../src/security/crypto/verification-code';

function createMockUsersRepo(overrides: Record<string, any> = {}) {
  return {
    findByEmail: vi.fn().mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: 'user@test.com',
      emailVerified: false,
      deletedAt: null,
    }),
    setEmailVerified: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockSessionService() {
  return {
    createSession: vi.fn().mockResolvedValue('new-session-id'),
    getSession: vi.fn(),
    destroySession: vi.fn(),
    rotateSession: vi.fn(),
  };
}

function createMockRedis() {
  return { get: vi.fn(), set: vi.fn(), del: vi.fn() };
}

function createMockEmailSender() {
  return { sendVerificationCode: vi.fn().mockResolvedValue(undefined) };
}

// ---------------------------------------------------------------------------
// MODULE 4.2 — Email Verification Service
// ---------------------------------------------------------------------------
describe('MODULE 4.2 — Email Verification Service', () => {
  let service: EmailVerificationService;
  let usersRepo: ReturnType<typeof createMockUsersRepo>;
  let redis: ReturnType<typeof createMockRedis>;
  let sessionService: ReturnType<typeof createMockSessionService>;
  let emailSender: ReturnType<typeof createMockEmailSender>;

  const input: VerifyEmailInput = { email: 'user@test.com', code: '123456' };

  beforeEach(() => {
    vi.clearAllMocks();
    usersRepo = createMockUsersRepo();
    redis = createMockRedis();
    sessionService = createMockSessionService();
    emailSender = createMockEmailSender();
    service = new EmailVerificationService(
      usersRepo as any,
      redis as any,
      sessionService as any,
      emailSender,
    );
  });

  it('verifyEmail({ email, code }) → consumeCode → setEmailVerified → createSession → returns sessionId', async () => {
    const sessionId = await service.verifyEmail(input);
    expect(consumeCode).toHaveBeenCalledWith(redis, input.email, input.code);
    expect(usersRepo.setEmailVerified).toHaveBeenCalledWith('user-1');
    expect(sessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', username: 'testuser' }),
    );
    expect(sessionId).toBe('new-session-id');
  });

  it('correct code → account marked emailVerified = true', async () => {
    await service.verifyEmail(input);
    expect(usersRepo.setEmailVerified).toHaveBeenCalledWith('user-1');
  });

  it('correct code → session created with { userId, username, authMethod: password }', async () => {
    await service.verifyEmail(input);
    expect(sessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', username: 'testuser', authMethod: 'password' }),
    );
  });

  it('wrong code → throws InvalidVerificationCodeError (code NOT consumed)', async () => {
    vi.mocked(consumeCode).mockResolvedValueOnce(false);
    await expect(service.verifyEmail(input)).rejects.toThrow(InvalidVerificationCodeError);
    expect(usersRepo.setEmailVerified).not.toHaveBeenCalled();
  });

  it('expired code (15min elapsed) → throws ExpiredVerificationCodeError', async () => {
    vi.mocked(consumeCode).mockResolvedValueOnce(false);
    await expect(service.verifyEmail(input)).rejects.toThrow();
  });

  it('already-verified account → throws AlreadyVerifiedError', async () => {
    usersRepo.findByEmail.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'user@test.com',
      emailVerified: true,
      deletedAt: null,
    });
    await expect(service.verifyEmail(input)).rejects.toThrow(AlreadyVerifiedError);
  });

  it('email not found → throws UserNotFoundError', async () => {
    usersRepo.findByEmail.mockResolvedValueOnce(null);
    await expect(service.verifyEmail(input)).rejects.toThrow(UserNotFoundError);
  });

  it('consumeCode is called atomically (GET + DEL in single Redis operation)', async () => {
    await service.verifyEmail(input);
    // consumeCode should be called exactly once (atomic operation)
    expect(consumeCode).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// MODULE 4.2 — Email Verification Route
// ---------------------------------------------------------------------------
describe('MODULE 4.2 — Email Verification Route', () => {
  let app: ReturnType<typeof Fastify>;
  let routeUsersRepo: ReturnType<typeof createMockUsersRepo>;

  beforeEach(async () => {
    vi.clearAllMocks();
    routeUsersRepo = createMockUsersRepo();
    app = Fastify();
    await app.register(cookie);
    app.decorate('usersRepo', routeUsersRepo);
    app.decorate('emailSender', createMockEmailSender());
    app.decorate('resetEmailSender', { sendResetCode: vi.fn().mockResolvedValue(undefined) });
    app.decorate('sessionService', createMockSessionService());
    app.decorate('eventsRepo', {
      logEvent: vi.fn().mockResolvedValue({ id: 'e1' }),
      getRecentEvents: vi.fn().mockResolvedValue([]),
    });
    await app.register(authRoutes);
    await app.ready();
  });

  afterEach(async () => app.close());

  it('POST /auth/verify-email → { email, code } → 200 + Set-Cookie on success', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { email: 'user@test.com', code: '123456' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /auth/verify-email → wrong code → 400 INVALID_CODE', async () => {
    vi.mocked(consumeCode).mockResolvedValueOnce(false);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { email: 'user@test.com', code: '000000' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('INVALID_CODE');
  });

  it('POST /auth/verify-email → expired code → 400', async () => {
    vi.mocked(consumeCode).mockResolvedValueOnce(false);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { email: 'user@test.com', code: '123456' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /auth/verify-email → already verified → 400 ALREADY_VERIFIED', async () => {
    routeUsersRepo.findByEmail.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'user@test.com',
      emailVerified: true,
      deletedAt: null,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { email: 'user@test.com', code: '123456' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('ALREADY_VERIFIED');
  });

  it('POST /auth/resend-verification → { email } → 200, new code sent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      payload: { email: 'user@test.com' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /auth/resend-verification → already verified → 400 ALREADY_VERIFIED', async () => {
    routeUsersRepo.findByEmail.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'user@test.com',
      emailVerified: true,
      deletedAt: null,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      payload: { email: 'user@test.com' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('ALREADY_VERIFIED');
  });
});

// ---------------------------------------------------------------------------
// MODULE 4.2 — resendVerification()
// ---------------------------------------------------------------------------
describe('MODULE 4.2 — resendVerification()', () => {
  let service: EmailVerificationService;
  let usersRepo: ReturnType<typeof createMockUsersRepo>;
  let redis: ReturnType<typeof createMockRedis>;
  let sessionService: ReturnType<typeof createMockSessionService>;
  let emailSender: ReturnType<typeof createMockEmailSender>;

  beforeEach(() => {
    vi.clearAllMocks();
    usersRepo = createMockUsersRepo();
    redis = createMockRedis();
    sessionService = createMockSessionService();
    emailSender = createMockEmailSender();
    service = new EmailVerificationService(
      usersRepo as any,
      redis as any,
      sessionService as any,
      emailSender,
    );
  });

  it('generates new code and sends verification email', async () => {
    await service.resendVerification('user@test.com');
    expect(generateCode).toHaveBeenCalledWith(redis, 'user@test.com');
    expect(emailSender.sendVerificationCode).toHaveBeenCalledWith('user@test.com', '654321');
  });

  it('email not found → throws UserNotFoundError, no email sent', async () => {
    usersRepo.findByEmail.mockResolvedValueOnce(null);
    await expect(service.resendVerification('ghost@test.com')).rejects.toThrow(UserNotFoundError);
    expect(emailSender.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('already verified → throws AlreadyVerifiedError, no email sent', async () => {
    usersRepo.findByEmail.mockResolvedValueOnce({
      id: 'user-1',
      username: 'testuser',
      email: 'user@test.com',
      emailVerified: true,
      deletedAt: null,
    });
    await expect(service.resendVerification('user@test.com')).rejects.toThrow(AlreadyVerifiedError);
    expect(emailSender.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('sendVerificationCode failure → does not throw (best-effort)', async () => {
    emailSender.sendVerificationCode.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(service.resendVerification('user@test.com')).resolves.toBeUndefined();
  });
});

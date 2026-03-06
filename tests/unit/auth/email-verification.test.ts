import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// ---------------------------------------------------------------------------
// MODULE 4.2 — Email Verification Service
// ---------------------------------------------------------------------------
describe('MODULE 4.2 — Email Verification Service', () => {
  let service: EmailVerificationService;
  let usersRepo: ReturnType<typeof createMockUsersRepo>;
  let redis: ReturnType<typeof createMockRedis>;
  let sessionService: ReturnType<typeof createMockSessionService>;

  const input: VerifyEmailInput = { email: 'user@test.com', code: '123456' };

  beforeEach(() => {
    vi.clearAllMocks();
    usersRepo = createMockUsersRepo();
    redis = createMockRedis();
    sessionService = createMockSessionService();
    service = new EmailVerificationService(
      usersRepo as any,
      redis as any,
      sessionService as any,
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
  it.todo('POST /auth/verify-email → { email, code } → 200 + Set-Cookie on success');
  it.todo('POST /auth/verify-email → wrong code → 400 INVALID_CODE');
  it.todo('POST /auth/verify-email → expired code → 400 CODE_EXPIRED');
  it.todo('POST /auth/verify-email → already verified → 400 ALREADY_VERIFIED');
  it.todo('POST /auth/resend-verification → { email } → 200, new code sent');
  it.todo('POST /auth/resend-verification → already verified → 400 ALREADY_VERIFIED');
});

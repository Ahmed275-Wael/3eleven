import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginService, type LoginInput } from '../../../src/security/auth/login.service';
import {
  InvalidCredentialsError,
  UnverifiedEmailError,
} from '../../../src/security/errors';

// ---------------------------------------------------------------------------
// Mock argon2 verifyPassword
// ---------------------------------------------------------------------------
vi.mock('../../../src/security/crypto/argon2', () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
}));
import { verifyPassword } from '../../../src/security/crypto/argon2';

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

// ---------------------------------------------------------------------------
// MODULE 4.3 — Login Service
// ---------------------------------------------------------------------------
describe('MODULE 4.3 — Login Service', () => {
  let service: LoginService;
  let usersRepo: ReturnType<typeof createMockUsersRepo>;
  let sessionService: ReturnType<typeof createMockSessionService>;

  const validInput: LoginInput = { username: 'testuser', password: 'securePass1!' };

  beforeEach(() => {
    vi.clearAllMocks();
    usersRepo = createMockUsersRepo();
    sessionService = createMockSessionService();
    service = new LoginService(usersRepo as any, sessionService as any);
  });

  it('login({ username, password }) → findByUsername → verifyPassword → createSession → returns sessionId', async () => {
    const sessionId = await service.login(validInput);
    expect(usersRepo.findByUsername).toHaveBeenCalledWith('testuser');
    expect(verifyPassword).toHaveBeenCalledWith('securePass1!', '$argon2id$hashed');
    expect(sessionService.createSession).toHaveBeenCalled();
    expect(sessionId).toBe('session-id-abc');
  });

  it('wrong username → throws InvalidCredentialsError (no user enumeration)', async () => {
    usersRepo.findByUsername.mockResolvedValueOnce(null);
    await expect(service.login(validInput)).rejects.toThrow(InvalidCredentialsError);
  });

  it('correct username, wrong password → throws InvalidCredentialsError', async () => {
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);
    await expect(service.login(validInput)).rejects.toThrow(InvalidCredentialsError);
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
    await service.login({ username: 'TestUser', password: 'securePass1!' });
    // Should normalize to lowercase before lookup
    expect(usersRepo.findByUsername).toHaveBeenCalledWith('testuser');
  });
});

// ---------------------------------------------------------------------------
// MODULE 4.3 — Login Route
// ---------------------------------------------------------------------------
describe('MODULE 4.3 — Login Route', () => {
  it.todo('POST /auth/login → { username, password } → 200 + Set-Cookie');
  it.todo('POST /auth/login → unverified → 403 EMAIL_NOT_VERIFIED');
  it.todo('POST /auth/login → wrong credentials → 401 INVALID_CREDENTIALS');
  it.todo('POST /auth/login → missing fields → 400 VALIDATION_ERROR');
  it.todo('POST /auth/logout → clears session + cookie → 200');
  it.todo('POST /auth/logout → no session cookie → still 200 (idempotent)');
});

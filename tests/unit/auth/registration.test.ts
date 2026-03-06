import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistrationService, type RegisterInput } from '../../../src/security/auth/registration.service';
import { DuplicateUsernameError, DuplicateEmailError, ValidationError } from '../../../src/security/errors';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('../../../src/security/crypto/argon2', () => ({
  hashPassword: vi.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$mock'),
}));

vi.mock('../../../src/security/crypto/verification-code', () => ({
  generateCode: vi.fn().mockResolvedValue('123456'),
}));

import { hashPassword } from '../../../src/security/crypto/argon2';
import { generateCode } from '../../../src/security/crypto/verification-code';

function createMockUsersRepo() {
  return {
    createUser: vi.fn().mockResolvedValue({
      id: 'uuid-1',
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: '$argon2id$mock',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }),
    findByUsername: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn(),
    setEmailVerified: vi.fn(),
    updatePasswordHash: vi.fn(),
    softDelete: vi.fn(),
  };
}

function createMockRedis() {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  };
}

function createMockEmailSender() {
  return { sendVerificationCode: vi.fn().mockResolvedValue(undefined) };
}

// ---------------------------------------------------------------------------
// MODULE 4.1 — Registration Service
// ---------------------------------------------------------------------------
describe('MODULE 4.1 — Registration Service', () => {
  let service: RegistrationService;
  let usersRepo: ReturnType<typeof createMockUsersRepo>;
  let redis: ReturnType<typeof createMockRedis>;
  let emailSender: ReturnType<typeof createMockEmailSender>;

  const validInput: RegisterInput = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'securePass1!',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    usersRepo = createMockUsersRepo();
    redis = createMockRedis();
    emailSender = createMockEmailSender();
    service = new RegistrationService(usersRepo as any, redis as any, emailSender);
  });

  it('register({ username, email, password }) → hashes password → inserts user row', async () => {
    await service.register(validInput);
    expect(hashPassword).toHaveBeenCalledWith(validInput.password);
    expect(usersRepo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mock',
      }),
    );
  });

  it('returns { userId, username, email } on success', async () => {
    const result = await service.register(validInput);
    expect(result).toEqual(
      expect.objectContaining({
        userId: expect.any(String),
        username: 'testuser',
        email: 'test@example.com',
      }),
    );
  });

  it('duplicate username → throws DuplicateUsernameError (check before hashing)', async () => {
    usersRepo.findByUsername.mockResolvedValueOnce({ id: 'existing' });
    await expect(service.register(validInput)).rejects.toThrow(DuplicateUsernameError);
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('duplicate email → throws DuplicateEmailError', async () => {
    usersRepo.findByEmail.mockResolvedValueOnce({ id: 'existing' });
    await expect(service.register(validInput)).rejects.toThrow(DuplicateEmailError);
  });

  it('username < 3 chars → throws ValidationError', async () => {
    await expect(service.register({ ...validInput, username: 'ab' })).rejects.toThrow(ValidationError);
  });

  it('username > 30 chars → throws ValidationError', async () => {
    await expect(service.register({ ...validInput, username: 'a'.repeat(31) })).rejects.toThrow(ValidationError);
  });

  it('username with spaces/special chars → throws ValidationError', async () => {
    await expect(service.register({ ...validInput, username: 'bad user!' })).rejects.toThrow(ValidationError);
  });

  it('password < 8 chars → throws ValidationError', async () => {
    await expect(service.register({ ...validInput, password: 'short' })).rejects.toThrow(ValidationError);
  });

  it('after insert → sendVerificationCode(email) called', async () => {
    await service.register(validInput);
    expect(generateCode).toHaveBeenCalledWith(redis, validInput.email);
    expect(emailSender.sendVerificationCode).toHaveBeenCalledWith(
      validInput.email,
      '123456',
    );
  });

  it('sendVerificationCode failure → user row still created (best-effort)', async () => {
    emailSender.sendVerificationCode.mockRejectedValueOnce(new Error('SMTP down'));
    const result = await service.register(validInput);
    expect(result.userId).toBeDefined();
    expect(usersRepo.createUser).toHaveBeenCalled();
  });

  it('register() does NOT create a session', async () => {
    const result = await service.register(validInput);
    // Result should NOT include a sessionId
    expect((result as any).sessionId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MODULE 4.1 — Registration Route
// ---------------------------------------------------------------------------
describe('MODULE 4.1 — Registration Route', () => {
  // Route tests use Fastify inject() — will fail until routes are implemented
  it.todo('POST /auth/register → 201 { userId, username, message }');
  it.todo('POST /auth/register → duplicate username → 409 USERNAME_TAKEN');
  it.todo('POST /auth/register → duplicate email → 409 EMAIL_TAKEN');
  it.todo('POST /auth/register → invalid body → 400 VALIDATION_ERROR');
  it.todo('POST /auth/register → does NOT return passwordHash');
});

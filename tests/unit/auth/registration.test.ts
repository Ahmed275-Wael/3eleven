import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../../../src/security/routes/auth.routes.js';
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
    app.decorate('sessionService', {
      createSession: vi.fn().mockResolvedValue('session-id'),
      destroySession: vi.fn().mockResolvedValue(true),
      getSession: vi.fn(),
      rotateSession: vi.fn(),
    });
    app.decorate('eventsRepo', {
      logEvent: vi.fn().mockResolvedValue({ id: 'e1' }),
      getRecentEvents: vi.fn().mockResolvedValue([]),
    });
    await app.register(authRoutes);
    await app.ready();
  });

  afterEach(async () => app.close());

  it('POST /auth/register → 201 { userId, username, message }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'testuser', email: 'test@example.com', password: 'securePass1!' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.userId).toBeDefined();
    expect(body.username).toBeDefined();
    expect(body.message).toBeDefined();
  });

  it('POST /auth/register → duplicate username → 409 USERNAME_TAKEN', async () => {
    routeUsersRepo.findByUsername.mockResolvedValueOnce({ id: 'existing-user' });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'testuser', email: 'test@example.com', password: 'securePass1!' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('USERNAME_TAKEN');
  });

  it('POST /auth/register → duplicate email → 409 EMAIL_TAKEN', async () => {
    routeUsersRepo.findByEmail.mockResolvedValueOnce({ id: 'existing-user' });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'newuser', email: 'test@example.com', password: 'securePass1!' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('EMAIL_TAKEN');
  });

  it('POST /auth/register → invalid body → 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'ab', email: 'not-an-email', password: '123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /auth/register → does NOT return passwordHash', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'testuser', email: 'test@example.com', password: 'securePass1!' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().passwordHash).toBeUndefined();
  });
});

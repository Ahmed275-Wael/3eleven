import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, type TestDb } from '../helpers/test-db';
import { UsersRepository, type User } from '../../src/security/users/users.repository';
import { DuplicateUsernameError, DuplicateEmailError } from '../../src/security/errors';

// Real PostgreSQL via testcontainers — no mocking

describe('MODULE 2.1 — User Repository (Integration)', () => {
  let testDb: TestDb;
  let repo: UsersRepository;

  beforeAll(async () => {
    testDb = await setupTestDb();
    repo = new UsersRepository(testDb.db);
  }, 60_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    // Clean tables between tests
    await testDb.client.unsafe('DELETE FROM security_events');
    await testDb.client.unsafe('DELETE FROM users');
  });

  const validUser = {
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mock_hash',
  };

  it('createUser() inserts row, returns { id, username, email, createdAt }', async () => {
    const user = await repo.createUser(validUser);
    expect(user.id).toBeDefined();
    expect(user.username).toBe('testuser');
    expect(user.email).toBe('test@example.com');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('newly created user has emailVerified = false', async () => {
    const user = await repo.createUser(validUser);
    expect(user.emailVerified).toBe(false);
  });

  it('findByUsername() → case-insensitive lookup', async () => {
    await repo.createUser(validUser);
    const user = await repo.findByUsername('TESTUSER');
    expect(user).not.toBeNull();
    expect(user!.username).toBe('testuser');
  });

  it('findByEmail() → returns user or null', async () => {
    await repo.createUser(validUser);
    const found = await repo.findByEmail('test@example.com');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('test@example.com');

    const notFound = await repo.findByEmail('nope@example.com');
    expect(notFound).toBeNull();
  });

  it('findById() → returns user or null', async () => {
    const created = await repo.createUser(validUser);
    const found = await repo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);

    const notFound = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(notFound).toBeNull();
  });

  it('duplicate username → throws DuplicateUsernameError', async () => {
    await repo.createUser(validUser);
    await expect(
      repo.createUser({ ...validUser, email: 'other@example.com' }),
    ).rejects.toThrow(DuplicateUsernameError);
  });

  it('duplicate email → throws DuplicateEmailError', async () => {
    await repo.createUser(validUser);
    await expect(
      repo.createUser({ ...validUser, username: 'otheruser' }),
    ).rejects.toThrow(DuplicateEmailError);
  });

  it('username always stored lowercase', async () => {
    const user = await repo.createUser({ ...validUser, username: 'MyUser' });
    expect(user.username).toBe('myuser');
  });

  it('setEmailVerified(userId) → sets emailVerified = true', async () => {
    const user = await repo.createUser(validUser);
    expect(user.emailVerified).toBe(false);
    await repo.setEmailVerified(user.id);
    const updated = await repo.findById(user.id);
    expect(updated!.emailVerified).toBe(true);
  });

  it('updatePasswordHash(userId, newHash) → updates column', async () => {
    const user = await repo.createUser(validUser);
    const newHash = '$argon2id$v=19$m=65536,t=3,p=4$new_hash';
    await repo.updatePasswordHash(user.id, newHash);
    const updated = await repo.findById(user.id);
    expect(updated!.passwordHash).toBe(newHash);
  });

  it('softDelete(userId) → sets deleted_at timestamp', async () => {
    const user = await repo.createUser(validUser);
    await repo.softDelete(user.id);
    // Direct query to check deleted_at is set
    const rows = await testDb.client.unsafe(
      `SELECT deleted_at FROM users WHERE id = '${user.id}'`,
    );
    expect(rows[0].deleted_at).not.toBeNull();
  });

  it('findByUsername() excludes soft-deleted users', async () => {
    const user = await repo.createUser(validUser);
    await repo.softDelete(user.id);
    const found = await repo.findByUsername('testuser');
    expect(found).toBeNull();
  });

  it('findByEmail() excludes soft-deleted users', async () => {
    const user = await repo.createUser(validUser);
    await repo.softDelete(user.id);
    const found = await repo.findByEmail('test@example.com');
    expect(found).toBeNull();
  });

  it('findById() excludes soft-deleted users', async () => {
    const user = await repo.createUser(validUser);
    await repo.softDelete(user.id);
    const found = await repo.findById(user.id);
    expect(found).toBeNull();
  });
});

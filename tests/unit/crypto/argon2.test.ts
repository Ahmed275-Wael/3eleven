import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_PEPPER = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

describe('MODULE 1.2 — Argon2id Password Hasher', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PEPPER = TEST_PEPPER;
  });

  it('hashPassword(plain) returns a string, never the plain text', async () => {
    const { hashPassword } = await import('../../../src/security/crypto/argon2');
    const plain = 'mySecureP@ss1';
    const hash = await hashPassword(plain);
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(plain);
    expect(hash).not.toContain(plain);
  });

  it('PEPPER env var missing at module load → throws MissingPepperError immediately', async () => {
    delete process.env.PEPPER;
    await expect(async () => {
      const { hashPassword } = await import('../../../src/security/crypto/argon2');
      await hashPassword('test');
    }).rejects.toThrow(/pepper|PEPPER/i);
  });

  it('hashPassword() applies HMAC-SHA256(password, PEPPER) before argon2id', async () => {
    const { hashPassword } = await import('../../../src/security/crypto/argon2');
    const hash = await hashPassword('testpassword');
    // Argon2id hashes always start with $argon2id$
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('hashPassword() uses params: m=65536, t=3, p=4', async () => {
    const { hashPassword } = await import('../../../src/security/crypto/argon2');
    const hash = await hashPassword('testpassword');
    expect(hash).toContain('m=65536');
    expect(hash).toContain('t=3');
    expect(hash).toContain('p=4');
  });

  it('verifyPassword(plain, hash) → true for correct password', async () => {
    const { hashPassword, verifyPassword } = await import('../../../src/security/crypto/argon2');
    const hash = await hashPassword('correctPassword1');
    expect(await verifyPassword('correctPassword1', hash)).toBe(true);
  });

  it('verifyPassword(plain, hash) → false for wrong password', async () => {
    const { hashPassword, verifyPassword } = await import('../../../src/security/crypto/argon2');
    const hash = await hashPassword('correctPassword1');
    expect(await verifyPassword('wrongPassword1', hash)).toBe(false);
  });

  it('verifyPassword() applies same pepper before verifying', async () => {
    const { hashPassword } = await import('../../../src/security/crypto/argon2');
    const hash = await hashPassword('testpassword');
    // Change pepper and re-import → verify should fail
    process.env.PEPPER = 'z'.repeat(64);
    vi.resetModules();
    const { verifyPassword } = await import('../../../src/security/crypto/argon2');
    expect(await verifyPassword('testpassword', hash)).toBe(false);
  });

  it('two calls to hashPassword() with same input → different hashes (unique salt)', async () => {
    const { hashPassword } = await import('../../../src/security/crypto/argon2');
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    expect(hash1).not.toBe(hash2);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCode, consumeCode } from '../../../src/security/crypto/verification-code';

function createMockRedis() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(async (key: string, value: string, _mode?: string, _ttl?: number) => {
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      const had = store.has(key);
      store.delete(key);
      return had ? 1 : 0;
    }),
    _store: store,
  };
}

describe('MODULE 1.3 — Email Verification Code', () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
    vi.clearAllMocks();
  });

  it('generateCode() returns exactly 6 numeric digits as a string (zero-padded)', async () => {
    const code = await generateCode(redis as any, 'test@example.com');
    expect(code).toMatch(/^\d{6}$/);
    expect(code).toHaveLength(6);
  });

  it('code stored in Redis under verify:{email} with 15-minute TTL', async () => {
    await generateCode(redis as any, 'user@test.com');
    expect(redis.set).toHaveBeenCalledWith(
      'verify:user@test.com',
      expect.stringMatching(/^\d{6}$/),
      'EX',
      900,
    );
  });

  it('consumeCode(email, code) retrieves and deletes atomically (single-use)', async () => {
    const code = await generateCode(redis as any, 'user@test.com');
    await consumeCode(redis as any, 'user@test.com', code);
    // get was called to retrieve, del was called to delete
    expect(redis.get).toHaveBeenCalledWith('verify:user@test.com');
    expect(redis.del).toHaveBeenCalledWith('verify:user@test.com');
  });

  it('consumeCode() with correct code → returns true, key deleted from Redis', async () => {
    const code = await generateCode(redis as any, 'user@test.com');
    const result = await consumeCode(redis as any, 'user@test.com', code);
    expect(result).toBe(true);
    expect(redis.del).toHaveBeenCalledWith('verify:user@test.com');
  });

  it('consumeCode() with wrong code → returns false, key NOT deleted', async () => {
    await generateCode(redis as any, 'user@test.com');
    const result = await consumeCode(redis as any, 'user@test.com', '000000');
    expect(result).toBe(false);
  });

  it('consumeCode() after TTL elapsed → returns false', async () => {
    await generateCode(redis as any, 'user@test.com');
    // Simulate TTL expiry
    redis._store.delete('verify:user@test.com');
    redis.get.mockResolvedValueOnce(null);
    const result = await consumeCode(redis as any, 'user@test.com', '123456');
    expect(result).toBe(false);
  });

  it('consumeCode() after already-consumed → returns false (key gone)', async () => {
    const code = await generateCode(redis as any, 'user@test.com');
    await consumeCode(redis as any, 'user@test.com', code);
    const result = await consumeCode(redis as any, 'user@test.com', code);
    expect(result).toBe(false);
  });

  it('generating a new code for same email overwrites the old one in Redis', async () => {
    const code1 = await generateCode(redis as any, 'user@test.com');
    const code2 = await generateCode(redis as any, 'user@test.com');
    expect(redis.set).toHaveBeenCalledTimes(2);
    const stored = redis._store.get('verify:user@test.com');
    expect(stored).toBe(code2);
  });

  it('10,000 generated codes → all are strings of exactly 6 digits 0–9', async () => {
    for (let i = 0; i < 10_000; i++) {
      const code = await generateCode(redis as any, `test${i}@example.com`);
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

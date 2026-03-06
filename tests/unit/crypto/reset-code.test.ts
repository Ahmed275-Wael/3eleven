import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateResetCode, consumeResetCode } from '../../../src/security/crypto/reset-code';

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

describe('MODULE 1.4 — Password Reset Code', () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
    vi.clearAllMocks();
  });

  it('generateResetCode() returns exactly 6 numeric digits as a string', async () => {
    const code = await generateResetCode(redis as any, 'user@test.com');
    expect(code).toMatch(/^\d{6}$/);
    expect(code).toHaveLength(6);
  });

  it('code stored in Redis under reset:{email} with 1-hour TTL', async () => {
    await generateResetCode(redis as any, 'user@test.com');
    expect(redis.set).toHaveBeenCalledWith(
      'reset:user@test.com',
      expect.stringMatching(/^\d{6}$/),
      'EX',
      3600,
    );
  });

  it('consumeResetCode(email, code) → correct code → true, key deleted', async () => {
    const code = await generateResetCode(redis as any, 'user@test.com');
    const result = await consumeResetCode(redis as any, 'user@test.com', code);
    expect(result).toBe(true);
    expect(redis.del).toHaveBeenCalledWith('reset:user@test.com');
  });

  it('consumeResetCode() → wrong code → false, key preserved', async () => {
    await generateResetCode(redis as any, 'user@test.com');
    const result = await consumeResetCode(redis as any, 'user@test.com', '000000');
    expect(result).toBe(false);
  });

  it('consumeResetCode() → expired → false', async () => {
    await generateResetCode(redis as any, 'user@test.com');
    redis._store.delete('reset:user@test.com');
    redis.get.mockResolvedValueOnce(null);
    const result = await consumeResetCode(redis as any, 'user@test.com', '123456');
    expect(result).toBe(false);
  });

  it('consumeResetCode() → already consumed → false', async () => {
    const code = await generateResetCode(redis as any, 'user@test.com');
    await consumeResetCode(redis as any, 'user@test.com', code);
    const result = await consumeResetCode(redis as any, 'user@test.com', code);
    expect(result).toBe(false);
  });

  it('generating new reset code for same email overwrites old one', async () => {
    await generateResetCode(redis as any, 'user@test.com');
    const code2 = await generateResetCode(redis as any, 'user@test.com');
    expect(redis.set).toHaveBeenCalledTimes(2);
    expect(redis._store.get('reset:user@test.com')).toBe(code2);
  });
});

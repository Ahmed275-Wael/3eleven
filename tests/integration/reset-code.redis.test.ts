import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestRedis, type TestRedis } from '../helpers/test-redis';
import { generateResetCode, consumeResetCode } from '../../src/security/crypto/reset-code';

// Real Redis via testcontainers

describe('Reset Code — Redis Integration', () => {
  let testRedis: TestRedis;

  beforeAll(async () => {
    testRedis = await setupTestRedis();
  }, 60_000);

  afterAll(async () => {
    await testRedis.teardown();
  });

  beforeEach(async () => {
    await testRedis.redis.flushdb();
  });

  it('generateResetCode → stores under reset:{email} with 1hr TTL', async () => {
    const code = await generateResetCode(testRedis.redis, 'user@test.com');
    expect(code).toMatch(/^\d{6}$/);

    const stored = await testRedis.redis.get('reset:user@test.com');
    expect(stored).toBe(code);

    const ttl = await testRedis.redis.ttl('reset:user@test.com');
    expect(ttl).toBeGreaterThan(3595);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it('consumeResetCode with correct code → returns true, key deleted', async () => {
    const code = await generateResetCode(testRedis.redis, 'user@test.com');
    const result = await consumeResetCode(testRedis.redis, 'user@test.com', code);
    expect(result).toBe(true);

    const remaining = await testRedis.redis.get('reset:user@test.com');
    expect(remaining).toBeNull();
  });

  it('consumeResetCode with wrong code → returns false, key preserved', async () => {
    const code = await generateResetCode(testRedis.redis, 'user@test.com');
    const result = await consumeResetCode(testRedis.redis, 'user@test.com', '000000');
    expect(result).toBe(false);

    const stored = await testRedis.redis.get('reset:user@test.com');
    expect(stored).toBe(code);
  });

  it('key expires after 1 hour (verified via Redis TTL)', async () => {
    await generateResetCode(testRedis.redis, 'user@test.com');
    const ttl = await testRedis.redis.ttl('reset:user@test.com');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it('new reset code for same email overwrites old one', async () => {
    const code1 = await generateResetCode(testRedis.redis, 'user@test.com');
    const code2 = await generateResetCode(testRedis.redis, 'user@test.com');

    const stored = await testRedis.redis.get('reset:user@test.com');
    expect(stored).toBe(code2);

    if (code1 !== code2) {
      const result = await consumeResetCode(testRedis.redis, 'user@test.com', code1);
      expect(result).toBe(false);
    }
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestRedis, type TestRedis } from '../helpers/test-redis';
import { generateCode, consumeCode } from '../../src/security/crypto/verification-code';

// Real Redis via testcontainers

describe('Verification Code — Redis Integration', () => {
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

  it('generateCode → stores under verify:{email} with 15min TTL', async () => {
    const code = await generateCode(testRedis.redis, 'user@test.com');
    expect(code).toMatch(/^\d{6}$/);

    const stored = await testRedis.redis.get('verify:user@test.com');
    expect(stored).toBe(code);

    const ttl = await testRedis.redis.ttl('verify:user@test.com');
    // TTL should be close to 900 seconds (15 min), allow some tolerance
    expect(ttl).toBeGreaterThan(895);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('consumeCode with correct code → returns true, key deleted', async () => {
    const code = await generateCode(testRedis.redis, 'user@test.com');
    const result = await consumeCode(testRedis.redis, 'user@test.com', code);
    expect(result).toBe(true);

    const remaining = await testRedis.redis.get('verify:user@test.com');
    expect(remaining).toBeNull();
  });

  it('consumeCode with wrong code → returns false, key preserved', async () => {
    const code = await generateCode(testRedis.redis, 'user@test.com');
    const result = await consumeCode(testRedis.redis, 'user@test.com', '000000');
    expect(result).toBe(false);

    // Key should still exist
    const stored = await testRedis.redis.get('verify:user@test.com');
    expect(stored).toBe(code);
  });

  it('key expires after 15 minutes (verified via Redis TTL)', async () => {
    await generateCode(testRedis.redis, 'user@test.com');
    const ttl = await testRedis.redis.ttl('verify:user@test.com');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(900);
  });

  it('new code for same email overwrites old one', async () => {
    const code1 = await generateCode(testRedis.redis, 'user@test.com');
    const code2 = await generateCode(testRedis.redis, 'user@test.com');

    const stored = await testRedis.redis.get('verify:user@test.com');
    expect(stored).toBe(code2);

    // Old code should no longer work
    const result = await consumeCode(testRedis.redis, 'user@test.com', code1);
    // If code1 !== code2, it should fail; if they happen to match, it's fine
    if (code1 !== code2) {
      expect(result).toBe(false);
    }
  });
});

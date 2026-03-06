import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestRedis, type TestRedis } from '../helpers/test-redis';
import { SessionService, type SessionPayload } from '../../src/security/session/session.service';

// Real Redis via testcontainers

describe('Session — Redis Integration', () => {
  let testRedis: TestRedis;
  let service: SessionService;

  const payload: SessionPayload = {
    userId: 'user-123',
    username: 'integrationuser',
    authMethod: 'password',
  };

  beforeAll(async () => {
    testRedis = await setupTestRedis();
    service = new SessionService(testRedis.redis);
  }, 60_000);

  afterAll(async () => {
    await testRedis.teardown();
  });

  beforeEach(async () => {
    await testRedis.redis.flushdb();
  });

  it('createSession → getSession round-trip returns same payload', async () => {
    const sessionId = await service.createSession(payload);
    expect(typeof sessionId).toBe('string');

    const retrieved = await service.getSession(sessionId);
    expect(retrieved).toEqual(payload);
  });

  it('TTL is set and readable via Redis TTL command', async () => {
    const sessionId = await service.createSession(payload);
    const ttl = await testRedis.redis.ttl(`session:${sessionId}`);
    // Should be close to 7 days (604800 seconds)
    expect(ttl).toBeGreaterThan(604790);
    expect(ttl).toBeLessThanOrEqual(604800);
  });

  it('destroySession → getSession returns null', async () => {
    const sessionId = await service.createSession(payload);
    await service.destroySession(sessionId);
    const retrieved = await service.getSession(sessionId);
    expect(retrieved).toBeNull();
  });

  it('session expired after TTL → getSession returns null', async () => {
    const sessionId = await service.createSession(payload);
    // Force expire the key immediately to simulate TTL elapsed
    await testRedis.redis.del(`session:${sessionId}`);
    const retrieved = await service.getSession(sessionId);
    expect(retrieved).toBeNull();
  });
});

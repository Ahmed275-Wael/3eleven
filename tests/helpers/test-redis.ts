/**
 * Test helper — spins up a real Redis container via testcontainers.
 * Provides a ready-to-use ioredis client.
 *
 * Usage in tests:
 *   const { redis, teardown } = await setupTestRedis();
 *   afterAll(() => teardown());
 */

import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import Redis from 'ioredis';

export interface TestRedis {
  redis: Redis;
  teardown: () => Promise<void>;
}

export async function setupTestRedis(): Promise<TestRedis> {
  const container: StartedTestContainer = await new GenericContainer('redis:7')
    .withExposedPorts(6379)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);

  const redis = new Redis({ host, port, maxRetriesPerRequest: 1 });

  // Wait for connection
  await redis.ping();

  return {
    redis,
    teardown: async () => {
      await redis.quit();
      await container.stop();
    },
  };
}

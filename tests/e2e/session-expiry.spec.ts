import { test, expect } from '@playwright/test';
import Redis from 'ioredis';

const API = '/auth';

test.describe('E2E-6 — Session Expiry', () => {
  let redis: Redis;

  test.beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  });

  test.afterAll(async () => {
    await redis.quit();
  });

  test('login → delete Redis session → next request → 401', async ({ request }) => {
    const email = `session_${Date.now()}@test.com`;
    const username = `sessionuser${Date.now()}`;
    const password = 'SecureP@ss123';

    // Register + verify
    await request.post(`${API}/register`, {
      data: { username, email, password },
    });
    const code = await redis.get(`verify:${email}`);
    await request.post(`${API}/verify-email`, { data: { email, code } });

    // Login to get a session
    const loginRes = await request.post(`${API}/login`, {
      data: { username, password },
    });
    expect(loginRes.status()).toBe(200);

    // Extract session cookie value
    const cookies = loginRes.headers()['set-cookie'] ?? '';
    // Destroy ALL session keys in Redis to simulate expiry
    const sessionKeys = await redis.keys('session:*');
    for (const key of sessionKeys) {
      await redis.del(key);
    }

    // Next authenticated request should get 401
    // Use a protected endpoint (e.g., GET /auth/me or POST /auth/logout)
    const protectedRes = await request.post(`${API}/logout`, {
      headers: { cookie: cookies },
    });
    // Logout is idempotent, so even with expired session it returns 200
    // But accessing a truly protected route should return 401
    // For now test that session destruction is effective:
    const meRes = await request.get(`${API}/me`, {
      headers: { cookie: cookies },
    });
    expect(meRes.status()).toBe(401);
  });
});

import { test, expect } from '@playwright/test';

const API = '/auth';

test.describe('E2E-7 — Rate Limit Wall (Login)', () => {
  test('6 wrong-password attempts → 429 with Retry-After', async ({ request }) => {
    const username = `ratelimit${Date.now()}`;

    // Send 6 rapid failed login attempts from the same "IP"
    for (let i = 0; i < 6; i++) {
      const res = await request.post(`${API}/login`, {
        data: { username, password: 'WrongPassword!' },
      });
      // First 5 may return 401 (invalid), 6th should be 429
      if (i < 5) {
        expect([401, 429]).toContain(res.status());
      }
    }

    // 7th attempt should definitely be rate limited
    const finalRes = await request.post(`${API}/login`, {
      data: { username, password: 'WrongPassword!' },
    });
    expect(finalRes.status()).toBe(429);

    // Should include Retry-After header
    const retryAfter = finalRes.headers()['retry-after'];
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});

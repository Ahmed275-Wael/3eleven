import { test, expect } from '@playwright/test';
import Redis from 'ioredis';

const API = '/auth';

test.describe('E2E-5 — Forgot Password Full Flow (6-Digit Code)', () => {
  let redis: Redis;

  test.beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  });

  test.afterAll(async () => {
    await redis.quit();
  });

  test('forgot password → 6-digit code email → reset → old password fails, new works', async ({ request }) => {
    const email = `reset_${Date.now()}@test.com`;
    const username = `resetuser${Date.now()}`;
    const oldPassword = 'OldP@ssword1';
    const newPassword = 'NewP@ssword1';

    // Step 1: Register + verify
    await request.post(`${API}/register`, {
      data: { username, email, password: oldPassword },
    });
    const verifyCode = await redis.get(`verify:${email}`);
    await request.post(`${API}/verify-email`, { data: { email, code: verifyCode } });

    // Step 2: Request password reset
    const forgotRes = await request.post(`${API}/forgot-password`, {
      data: { email },
    });
    expect(forgotRes.status()).toBe(200);

    // Step 3: Get reset code from Redis
    const resetCode = await redis.get(`reset:${email}`);
    expect(resetCode).not.toBeNull();
    expect(resetCode).toMatch(/^\d{6}$/);

    // Step 4: Reset password
    const resetRes = await request.post(`${API}/reset-password`, {
      data: { email, code: resetCode, newPassword },
    });
    expect(resetRes.status()).toBe(200);

    // Step 5: Old password should fail
    const loginOld = await request.post(`${API}/login`, {
      data: { username, password: oldPassword },
    });
    expect(loginOld.status()).toBe(401);

    // Step 6: New password should work
    const loginNew = await request.post(`${API}/login`, {
      data: { username, password: newPassword },
    });
    expect(loginNew.status()).toBe(200);
  });
});

// MODULE 1.3 — Email Verification Code

import { randomInt } from 'node:crypto';
import type Redis from 'ioredis';

const KEY_PREFIX = 'verify:';
const TTL_SECONDS = 900; // 15 minutes

export async function generateCode(redis: Redis, email: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await redis.set(`${KEY_PREFIX}${email}`, code, 'EX', TTL_SECONDS);
  return code;
}

export async function consumeCode(redis: Redis, email: string, code: string): Promise<boolean> {
  const key = `${KEY_PREFIX}${email}`;
  const stored = await redis.get(key);
  if (!stored || stored !== code) return false;
  await redis.del(key);
  return true;
}

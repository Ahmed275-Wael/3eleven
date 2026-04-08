// MODULE 3.1 — Session Service

import type Redis from 'ioredis';
import { generateSessionId } from '../crypto/session-id.js';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 604800; // 7 days in seconds

export interface SessionPayload {
  userId: string;
  username: string;
  authMethod: 'password';
}

export class SessionService {
  constructor(private readonly redis: Redis) {}

  async createSession(payload: SessionPayload): Promise<string> {
    const id = generateSessionId();
    await this.redis.set(
      `${SESSION_PREFIX}${id}`,
      JSON.stringify(payload),
      'EX',
      SESSION_TTL,
    );
    return id;
  }

  async getSession(id: string): Promise<SessionPayload | null> {
    const key = `${SESSION_PREFIX}${id}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    // Sliding expiry — extend TTL on every read
    await this.redis.expire(key, SESSION_TTL);
    return JSON.parse(data) as SessionPayload;
  }

  async destroySession(id: string): Promise<boolean> {
    const deleted = await this.redis.del(`${SESSION_PREFIX}${id}`);
    return deleted > 0;
  }

  async rotateSession(id: string): Promise<string> {
    const payload = await this.getSession(id);
    if (!payload) throw new Error('Session not found');
    await this.destroySession(id);
    return this.createSession(payload);
  }
}

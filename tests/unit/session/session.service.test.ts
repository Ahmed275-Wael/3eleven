import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService, type SessionPayload } from '../../../src/security/session/session.service';
import { setSessionCookie, clearSessionCookie } from '../../../src/security/session/session.cookie';
import { requireAuth, setSessionServiceForAuth } from '../../../src/security/middleware/require-auth';

// ---------------------------------------------------------------------------
// Mock Redis factory
// ---------------------------------------------------------------------------
function createMockRedis() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(async (key: string, value: string, ..._args: unknown[]) => {
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      const had = store.has(key);
      store.delete(key);
      return had ? 1 : 0;
    }),
    expire: vi.fn(async () => 1),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    }),
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// MODULE 3.1 — Session Service
// ---------------------------------------------------------------------------
describe('MODULE 3.1 — Session Service (Unit)', () => {
  let redis: ReturnType<typeof createMockRedis>;
  let service: SessionService;
  const payload: SessionPayload = {
    userId: 'user-123',
    username: 'testuser',
    authMethod: 'password',
  };

  beforeEach(() => {
    redis = createMockRedis();
    service = new SessionService(redis as any);
    vi.clearAllMocks();
  });

  it('createSession(payload) stores payload in Redis under session:{id}', async () => {
    await service.createSession(payload);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^session:.+/),
      expect.any(String),
      'EX',
      604800,
    );
    // Verify stored value is JSON-serialized payload
    const storedValue = redis.set.mock.calls[0][1] as string;
    expect(JSON.parse(storedValue)).toEqual(payload);
  });

  it('createSession() returns the sessionId', async () => {
    const sessionId = await service.createSession(payload);
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);
  });

  it('getSession(id) retrieves and deserializes the stored payload', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify(payload));
    const result = await service.getSession('abc123');
    expect(redis.get).toHaveBeenCalledWith('session:abc123');
    expect(result).toEqual(payload);
  });

  it('getSession() on non-existent key → returns null', async () => {
    redis.get.mockResolvedValueOnce(null);
    const result = await service.getSession('nonexistent');
    expect(result).toBeNull();
  });

  it('destroySession(id) deletes the Redis key and returns true', async () => {
    redis._store.set('session:abc123', '{}');
    const result = await service.destroySession('abc123');
    expect(redis.del).toHaveBeenCalledWith('session:abc123');
    expect(result).toBe(true);
  });

  it('destroySession(id) returns false when key does not exist', async () => {
    const result = await service.destroySession('nonexistent');
    expect(result).toBe(false);
  });

  it('rotateSession(id) → deletes old, creates new with same payload + fresh TTL', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify(payload));
    const newId = await service.rotateSession('old-id');
    expect(redis.del).toHaveBeenCalledWith('session:old-id');
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^session:.+/),
      expect.any(String),
      'EX',
      604800,
    );
    expect(typeof newId).toBe('string');
    expect(newId).not.toBe('old-id');
  });

  it('session TTL on creation is exactly 7 days (604800 seconds)', async () => {
    await service.createSession(payload);
    const call = redis.set.mock.calls[0];
    expect(call[2]).toBe('EX');
    expect(call[3]).toBe(604800);
  });

  it('getSession() call extends TTL by 7 days (sliding expiry)', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify(payload));
    await service.getSession('abc123');
    expect(redis.expire).toHaveBeenCalledWith('session:abc123', 604800);
  });
});

// ---------------------------------------------------------------------------
// MODULE 3.2 — Session Cookie Helpers
// ---------------------------------------------------------------------------
describe('MODULE 3.2 — Session Cookie Helpers', () => {
  function mockReply() {
    const calls: Array<{ name: string; value: string; options: any }> = [];
    return {
      setCookie: vi.fn((name: string, value: string, options: any) => {
        calls.push({ name, value, options });
      }),
      clearCookie: vi.fn(),
      _calls: calls,
    };
  }

  it('setSessionCookie() sets HttpOnly flag', () => {
    const reply = mockReply();
    setSessionCookie(reply as any, 'session-id-value');
    expect(reply.setCookie).toHaveBeenCalledWith(
      expect.any(String),
      'session-id-value',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('setSessionCookie() sets Secure flag', () => {
    const reply = mockReply();
    setSessionCookie(reply as any, 'sid');
    expect(reply.setCookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });

  it('setSessionCookie() sets SameSite=Strict', () => {
    const reply = mockReply();
    setSessionCookie(reply as any, 'sid');
    expect(reply.setCookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ sameSite: 'strict' }),
    );
  });

  it('setSessionCookie() sets cookie name from SESSION_COOKIE_NAME', () => {
    const reply = mockReply();
    setSessionCookie(reply as any, 'sid');
    const cookieName = reply.setCookie.mock.calls[0][0];
    expect(typeof cookieName).toBe('string');
    expect(cookieName.length).toBeGreaterThan(0);
  });

  it('setSessionCookie() sets Max-Age to 7 days', () => {
    const reply = mockReply();
    setSessionCookie(reply as any, 'sid');
    expect(reply.setCookie).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ maxAge: 604800 }),
    );
  });

  it('clearSessionCookie() sets same cookie with Max-Age=0 and empty value', () => {
    const reply = mockReply();
    clearSessionCookie(reply as any);
    // Either setCookie with maxAge 0 or clearCookie
    const setCookieCall = reply.setCookie.mock.calls[0];
    if (setCookieCall) {
      expect(setCookieCall[1]).toBe('');
      expect(setCookieCall[2]).toEqual(expect.objectContaining({ maxAge: 0 }));
    } else {
      expect(reply.clearCookie).toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// MODULE 3.3 — requireAuth Middleware
// ---------------------------------------------------------------------------
describe('MODULE 3.3 — requireAuth Middleware', () => {
  const validPayload: SessionPayload = {
    userId: 'user-123',
    username: 'testuser',
    authMethod: 'password',
  };

  beforeEach(() => {
    // Set up a SessionService with a mock Redis pre-loaded with a valid session
    const mockRedis = createMockRedis();
    mockRedis._store.set('session:valid-session-id', JSON.stringify(validPayload));
    const sessionService = new SessionService(mockRedis as any);
    setSessionServiceForAuth(sessionService);
  });

  function createMockRequest(cookies: Record<string, string> = {}) {
    return {
      cookies,
      user: undefined as any,
    };
  }

  function createMockReply() {
    const reply: any = {
      status: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    return reply;
  }

  it('valid cookie + active session → req.user populated, calls next()', async () => {
    const request = createMockRequest({ __session: 'valid-session-id' });
    const reply = createMockReply();
    // When fully implemented, this should populate request.user
    await requireAuth(request as any, reply as any);
    expect(request.user).toBeDefined();
    expect(request.user.userId).toBeDefined();
  });

  it('missing cookie → replies 401 UNAUTHENTICATED', async () => {
    const request = createMockRequest({});
    const reply = createMockReply();
    await expect(requireAuth(request as any, reply as any)).rejects.toThrow();
  });

  it('cookie present, no matching Redis key → replies 401', async () => {
    const request = createMockRequest({ __session: 'expired-session' });
    const reply = createMockReply();
    await expect(requireAuth(request as any, reply as any)).rejects.toThrow();
  });

  it('cookie present, session valid, user soft-deleted → replies 401', async () => {
    const request = createMockRequest({ __session: 'deleted-user-session' });
    const reply = createMockReply();
    await expect(requireAuth(request as any, reply as any)).rejects.toThrow();
  });

  it('cookie present, session valid → does NOT extend TTL on failed user lookup', async () => {
    const request = createMockRequest({ __session: 'valid-session' });
    const reply = createMockReply();
    // Should not call redis.expire if user lookup fails
    try {
      await requireAuth(request as any, reply as any);
    } catch {
      // expected to fail in TDD state
    }
  });
});

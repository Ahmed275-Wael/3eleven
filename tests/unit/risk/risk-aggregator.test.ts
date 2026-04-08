import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aggregate } from '../../../src/security/risk/risk.service';
import { SecurityEventsRepository } from '../../../src/security/risk/security-events.repository.js';

describe('MODULE 6.2 — Risk Aggregator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('aggregate([0, 0, 0]) → level = LOW, action = ALLOW', () => {
    const result = aggregate([0, 0, 0]);
    expect(result.level).toBe('LOW');
    expect(result.action).toBe('ALLOW');
  });

  it('aggregate([40, 20, 0]) → level = MEDIUM, action = STEP_UP', () => {
    const result = aggregate([40, 20, 0]);
    expect(result.level).toBe('MEDIUM');
    expect(result.action).toBe('STEP_UP');
  });

  it('aggregate([40, 50, 20]) → level = HIGH, action = FORCE_REAUTH', () => {
    const result = aggregate([40, 50, 20]);
    expect(result.level).toBe('HIGH');
    expect(result.action).toBe('FORCE_REAUTH');
  });

  it('aggregate([100, 50, 20]) → level = CRITICAL, action = LOCK_ACCOUNT', () => {
    const result = aggregate([100, 50, 20]);
    expect(result.level).toBe('CRITICAL');
    expect(result.action).toBe('LOCK_ACCOUNT');
  });

  it('thresholds are configurable via env', () => {
    process.env.RISK_MEDIUM_THRESHOLD = '10';
    process.env.RISK_HIGH_THRESHOLD = '20';
    process.env.RISK_CRITICAL_THRESHOLD = '30';
    // With thresholds lowered, [15, 0, 0] should be MEDIUM
    const result = aggregate([15, 0, 0]);
    expect(result.level).toBe('MEDIUM');
  });
});

describe('MODULE 6.3 — Security Event Logger', () => {
  const baseRow = {
    id: 'evt-1',
    userId: 'user-1',
    eventType: 'LOGIN_SUCCESS',
    ipAddress: '1.2.3.4',
    userAgent: null as string | null,
    riskLevel: 'LOW',
    metadata: null as Record<string, unknown> | null,
    createdAt: new Date(),
  };

  function buildMockDb(insertRow = baseRow, selectRows = [baseRow]) {
    const returning = vi.fn().mockResolvedValue([insertRow]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });

    const limit = vi.fn().mockResolvedValue(selectRows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    return { insert, select };
  }

  it('logEvent({ userId, type, ip, userAgent, riskLevel }) → inserts row', async () => {
    const db = buildMockDb();
    const repo = new SecurityEventsRepository(db as any);
    const result = await repo.logEvent({ userId: 'user-1', type: 'LOGIN_SUCCESS', ip: '1.2.3.4', riskLevel: 'LOW' });
    expect(db.insert).toHaveBeenCalled();
    expect(result.id).toBe('evt-1');
    expect(result.userId).toBe('user-1');
    expect(result.eventType).toBe('LOGIN_SUCCESS');
  });

  it('event row contains all fields: id, userId, eventType, ipAddress, etc.', async () => {
    const fullRow = { ...baseRow, eventType: 'LOGIN_FAILED', ipAddress: '10.0.0.1', userAgent: 'TestAgent/1.0', riskLevel: 'MEDIUM', metadata: { attempt: 3 } };
    const db = buildMockDb(fullRow);
    const repo = new SecurityEventsRepository(db as any);
    const result = await repo.logEvent({ userId: 'user-1', type: 'LOGIN_FAILED', ip: '10.0.0.1', userAgent: 'TestAgent/1.0', riskLevel: 'MEDIUM', metadata: { attempt: 3 } });
    expect(result.id).toBeDefined();
    expect(result.userId).toBe('user-1');
    expect(result.eventType).toBe('LOGIN_FAILED');
    expect(result.ipAddress).toBe('10.0.0.1');
    expect(result.userAgent).toBe('TestAgent/1.0');
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.metadata).toEqual({ attempt: 3 });
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('logEvent LOGIN_SUCCESS → persists', async () => {
    const db = buildMockDb({ ...baseRow, eventType: 'LOGIN_SUCCESS' });
    const repo = new SecurityEventsRepository(db as any);
    const result = await repo.logEvent({ userId: 'user-1', type: 'LOGIN_SUCCESS', ip: '1.2.3.4', riskLevel: 'LOW' });
    expect(result.eventType).toBe('LOGIN_SUCCESS');
  });

  it('logEvent LOGIN_FAILED → persists', async () => {
    const db = buildMockDb({ ...baseRow, eventType: 'LOGIN_FAILED', riskLevel: 'MEDIUM' });
    const repo = new SecurityEventsRepository(db as any);
    const result = await repo.logEvent({ userId: 'user-1', type: 'LOGIN_FAILED', ip: '5.6.7.8', riskLevel: 'MEDIUM' });
    expect(result.eventType).toBe('LOGIN_FAILED');
  });

  it('logEvent IMPOSSIBLE_TRAVEL → persists with riskLevel CRITICAL', async () => {
    const db = buildMockDb({ ...baseRow, eventType: 'IMPOSSIBLE_TRAVEL', riskLevel: 'CRITICAL' });
    const repo = new SecurityEventsRepository(db as any);
    const result = await repo.logEvent({ userId: 'user-1', type: 'IMPOSSIBLE_TRAVEL', ip: '9.10.11.12', riskLevel: 'CRITICAL' });
    expect(result.eventType).toBe('IMPOSSIBLE_TRAVEL');
    expect(result.riskLevel).toBe('CRITICAL');
  });

  it('logEvent ACCOUNT_LOCKED → persists', async () => {
    const db = buildMockDb({ ...baseRow, eventType: 'ACCOUNT_LOCKED', riskLevel: 'HIGH' });
    const repo = new SecurityEventsRepository(db as any);
    const result = await repo.logEvent({ userId: 'user-1', type: 'ACCOUNT_LOCKED', ip: '13.14.15.16', riskLevel: 'HIGH' });
    expect(result.eventType).toBe('ACCOUNT_LOCKED');
  });

  it('getRecentEvents(userId, limit) → returns N most recent events DESC', async () => {
    const rows = [
      { ...baseRow, id: 'e3', eventType: 'EVENT_3' },
      { ...baseRow, id: 'e2', eventType: 'EVENT_2' },
      { ...baseRow, id: 'e1', eventType: 'EVENT_1' },
    ];
    const db = buildMockDb(baseRow, rows);
    const repo = new SecurityEventsRepository(db as any);
    const events = await repo.getRecentEvents('user-1', 3);
    expect(events).toHaveLength(3);
    expect(events[0].eventType).toBe('EVENT_3');
    expect(events[1].eventType).toBe('EVENT_2');
    expect(events[2].eventType).toBe('EVENT_1');
  });
});

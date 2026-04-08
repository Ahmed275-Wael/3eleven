/**
 * Integration tests for SecurityEventsRepository — uses real PostgreSQL via testcontainers.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, type TestDb } from '../helpers/test-db';
import { SecurityEventsRepository } from '../../src/security/risk/security-events.repository';
import { UsersRepository } from '../../src/security/users/users.repository';

describe('MODULE 6.3 — Security Event Logger (Integration)', () => {
  let testDb: TestDb;
  let eventsRepo: SecurityEventsRepository;
  let usersRepo: UsersRepository;
  let testUserId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    eventsRepo = new SecurityEventsRepository(testDb.db);
    usersRepo = new UsersRepository(testDb.db);
  }, 60_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.client.unsafe('DELETE FROM security_events');
    await testDb.client.unsafe('DELETE FROM users');
    // Create a user for FK reference
    const user = await usersRepo.createUser({
      username: `evtuser${Date.now()}`,
      email: `evtuser${Date.now()}@test.com`,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mock',
    });
    testUserId = user.id;
  });

  it('logEvent({ userId, type, ip, userAgent, riskLevel }) → inserts row', async () => {
    const event = await eventsRepo.logEvent({
      userId: testUserId,
      type: 'LOGIN_SUCCESS',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      riskLevel: 'LOW',
    });
    expect(event.id).toBeDefined();
    expect(event.userId).toBe(testUserId);
    expect(event.eventType).toBe('LOGIN_SUCCESS');
  });

  it('event row contains all fields: id, userId, eventType, ipAddress, etc.', async () => {
    const event = await eventsRepo.logEvent({
      userId: testUserId,
      type: 'LOGIN_FAILED',
      ip: '10.0.0.1',
      userAgent: 'TestAgent/1.0',
      riskLevel: 'MEDIUM',
      metadata: { attempt: 3 },
    });
    expect(event.id).toBeDefined();
    expect(event.userId).toBe(testUserId);
    expect(event.eventType).toBe('LOGIN_FAILED');
    expect(event.ipAddress).toBe('10.0.0.1');
    expect(event.userAgent).toBe('TestAgent/1.0');
    expect(event.riskLevel).toBe('MEDIUM');
    expect(event.metadata).toEqual({ attempt: 3 });
    expect(event.createdAt).toBeInstanceOf(Date);
  });

  it('logEvent LOGIN_SUCCESS → persists', async () => {
    await eventsRepo.logEvent({
      userId: testUserId,
      type: 'LOGIN_SUCCESS',
      ip: '1.2.3.4',
      riskLevel: 'LOW',
    });
    const events = await eventsRepo.getRecentEvents(testUserId, 10);
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('LOGIN_SUCCESS');
  });

  it('logEvent LOGIN_FAILED → persists', async () => {
    await eventsRepo.logEvent({
      userId: testUserId,
      type: 'LOGIN_FAILED',
      ip: '5.6.7.8',
      riskLevel: 'MEDIUM',
    });
    const events = await eventsRepo.getRecentEvents(testUserId, 10);
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('LOGIN_FAILED');
  });

  it('logEvent IMPOSSIBLE_TRAVEL → persists with riskLevel CRITICAL', async () => {
    await eventsRepo.logEvent({
      userId: testUserId,
      type: 'IMPOSSIBLE_TRAVEL',
      ip: '9.10.11.12',
      riskLevel: 'CRITICAL',
    });
    const events = await eventsRepo.getRecentEvents(testUserId, 10);
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('IMPOSSIBLE_TRAVEL');
    expect(events[0].riskLevel).toBe('CRITICAL');
  });

  it('logEvent ACCOUNT_LOCKED → persists', async () => {
    await eventsRepo.logEvent({
      userId: testUserId,
      type: 'ACCOUNT_LOCKED',
      ip: '13.14.15.16',
      riskLevel: 'HIGH',
    });
    const events = await eventsRepo.getRecentEvents(testUserId, 10);
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('ACCOUNT_LOCKED');
  });

  it('getRecentEvents(userId, limit) → returns N most recent events DESC', async () => {
    // Insert 5 events with slight delay for ordering
    for (let i = 1; i <= 5; i++) {
      await eventsRepo.logEvent({
        userId: testUserId,
        type: `EVENT_${i}`,
        ip: `10.0.0.${i}`,
        riskLevel: 'LOW',
      });
    }

    const events = await eventsRepo.getRecentEvents(testUserId, 3);
    expect(events.length).toBe(3);
    // Most recent first (EVENT_5, EVENT_4, EVENT_3)
    expect(events[0].eventType).toBe('EVENT_5');
    expect(events[1].eventType).toBe('EVENT_4');
    expect(events[2].eventType).toBe('EVENT_3');
  });
});

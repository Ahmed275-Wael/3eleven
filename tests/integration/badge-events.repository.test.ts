/**
 * MODULE 10.6 — Badge Events Repository (Integration)
 *
 * Tests BadgeEventsRepository against a real PostgreSQL container.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import * as captureSchema from '../../src/capture/db/schema.js';
import { BadgeEventsRepository } from '../../src/capture/badge-events.repository.js';

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

const CREATE_TABLES_SQL = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS badge_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    event_date DATE,
    qualification_form_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS badge_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES badge_events(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    job_title VARCHAR(255),
    badge_pdf_path VARCHAR(1000),
    scanned_at TIMESTAMPTZ,
    lead_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, email)
  );
`;

type AllSchema = typeof captureSchema;

let container: StartedTestContainer;
let client: postgres.Sql;
let db: PostgresJsDatabase<AllSchema>;
let repo: BadgeEventsRepository;
let userId: string;
let eventId: string;

async function createUser(username = 'btest', email = 'b@example.com') {
  const rows = await client.unsafe<{ id: string }[]>(
    `INSERT INTO users (username, email, password_hash, email_verified)
     VALUES ($1, $2, 'hash', true) RETURNING id`,
    [username, email],
  );
  return rows[0].id;
}

beforeAll(async () => {
  container = await new GenericContainer('postgres:16')
    .withExposedPorts(5432)
    .withEnvironment({ POSTGRES_DB: 'testdb', POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test' })
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  client = postgres(`postgresql://test:test@${host}:${port}/testdb`);
  db = drizzle(client, { schema: captureSchema });

  await client.unsafe(CREATE_TABLES_SQL);
  userId = await createUser();
  repo = new BadgeEventsRepository(db as any);
}, 120_000);

afterAll(async () => {
  await client.end();
  await container.stop();
});

beforeEach(async () => {
  await client.unsafe('DELETE FROM badge_attendees');
  await client.unsafe('DELETE FROM badge_events');
  // Re-create a fresh event for most tests
  const event = await repo.createEvent({ userId, name: 'Test Event', eventDate: undefined });
  eventId = event.id;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MODULE 10.6 — Badge Events Repository (Integration)', () => {
  it('createEvent: inserts event and returns it', async () => {
    const event = await repo.createEvent({ userId, name: 'SXSW 2026', eventDate: '2026-03-15' });
    expect(event.id).toBeDefined();
    expect(event.name).toBe('SXSW 2026');
    expect(event.userId).toBe(userId);
  });

  it('findEventById: returns event for correct owner', async () => {
    const found = await repo.findEventById(userId, eventId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(eventId);
  });

  it('findEventById: returns null for wrong user', async () => {
    const userId2 = await createUser('other', 'other@b.com');
    const found = await repo.findEventById(userId2, eventId);
    expect(found).toBeNull();
  });

  it('listEventsByUser: returns only that user events', async () => {
    const userId2 = await createUser('u2', 'u2@b.com');
    await repo.createEvent({ userId: userId2, name: 'Other Event', eventDate: undefined });
    const events = await repo.listEventsByUser(userId);
    expect(events.length).toBeGreaterThanOrEqual(1);
    events.forEach(e => expect(e.userId).toBe(userId));
  });

  it('addAttendees: inserts attendees and returns count', async () => {
    const count = await repo.addAttendees(eventId, [
      { email: 'a@b.com', firstName: 'A', lastName: 'B' },
      { email: 'c@d.com', firstName: 'C', lastName: 'D' },
    ]);
    expect(count).toBe(2);
  });

  it('addAttendees: duplicate email within same event is skipped', async () => {
    await repo.addAttendees(eventId, [{ email: 'dup@b.com', firstName: 'D', lastName: 'Up' }]);
    const count = await repo.addAttendees(eventId, [{ email: 'dup@b.com', firstName: 'D2', lastName: 'Up2' }]);
    expect(count).toBe(0); // conflict ignored
  });

  it('getAttendees: returns attendees ordered by createdAt ASC', async () => {
    await repo.addAttendees(eventId, [
      { email: 'first@b.com', firstName: 'First', lastName: 'One' },
      { email: 'second@b.com', firstName: 'Second', lastName: 'Two' },
    ]);
    const attendees = await repo.getAttendees(eventId);
    expect(attendees).toHaveLength(2);
    expect(attendees[0].email).toBe('first@b.com');
  });

  it('findAttendeeById: returns correct attendee', async () => {
    await repo.addAttendees(eventId, [{ email: 'find@b.com', firstName: 'A', lastName: 'B' }]);
    const all = await repo.getAttendees(eventId);
    const found = await repo.findAttendeeById(eventId, all[0].id);
    expect(found).not.toBeNull();
    expect(found!.email).toBe('find@b.com');
  });

  it('findAttendeeById: returns null for wrong event', async () => {
    await repo.addAttendees(eventId, [{ email: 'x@b.com', firstName: 'X', lastName: 'Y' }]);
    const all = await repo.getAttendees(eventId);
    const found = await repo.findAttendeeById('00000000-0000-0000-0000-000000000000', all[0].id);
    expect(found).toBeNull();
  });

  it('scanAttendee: sets scannedAt and leadId', async () => {
    await repo.addAttendees(eventId, [{ email: 'scan@b.com', firstName: 'S', lastName: 'C' }]);
    const attendees = await repo.getAttendees(eventId);
    const attendeeId = attendees[0].id;

    await repo.scanAttendee(attendeeId, '11111111-1111-1111-1111-111111111111');

    const updated = await repo.findAttendeeById(eventId, attendeeId);
    expect(updated!.scannedAt).not.toBeNull();
    expect(updated!.leadId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('deleteEvent: removes event and cascades attendees', async () => {
    await repo.addAttendees(eventId, [{ email: 'del@b.com', firstName: 'D', lastName: 'E' }]);
    const deleted = await repo.deleteEvent(userId, eventId);
    expect(deleted).toBe(true);
    const found = await repo.findEventById(userId, eventId);
    expect(found).toBeNull();
  });

  it('deleteEvent: returns false for wrong user', async () => {
    const result = await repo.deleteEvent('00000000-0000-0000-0000-000000000001', eventId);
    expect(result).toBe(false);
  });
});

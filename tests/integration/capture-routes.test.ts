/**
 * MODULE 10.7 — Capture Routes (Integration)
 *
 * Full HTTP integration tests using testcontainers (real PG + real Redis).
 * Tests every endpoint in the capture routes via fastify.inject().
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import Redis from 'ioredis';
import * as securitySchema from '../../src/security/db/schema.js';
import * as leadsSchema from '../../src/leads/db/schema.js';
import * as captureSchema from '../../src/capture/db/schema.js';
import { UsersRepository } from '../../src/security/users/users.repository.js';
import { SessionService } from '../../src/security/session/session.service.js';
import { LeadsRepository } from '../../src/leads/leads.repository.js';
import { ListsRepository } from '../../src/leads/lists.repository.js';
import { TagsRepository } from '../../src/leads/tags.repository.js';
import { NotesRepository } from '../../src/leads/notes.repository.js';
import { BlacklistRepository } from '../../src/leads/blacklist.repository.js';
import { LeadsService } from '../../src/leads/leads.service.js';
import { ListsService } from '../../src/leads/lists.service.js';
import { FormsRepository } from '../../src/capture/forms.repository.js';
import { BadgeEventsRepository } from '../../src/capture/badge-events.repository.js';
import { FormsService } from '../../src/capture/forms.service.js';
import { BadgeService } from '../../src/capture/badge.service.js';
import { CsvService } from '../../src/capture/csv.service.js';
import { captureRoutes } from '../../src/capture/routes/capture.routes.js';
import { setupTestRedis, type TestRedis } from '../helpers/test-redis.js';

// ---------------------------------------------------------------------------
// DB — all tables: security + leads + capture
// ---------------------------------------------------------------------------

const ALL_TABLES_SQL = `
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
  CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL, ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT, risk_level VARCHAR(20) NOT NULL, metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL, first_name VARCHAR(100), last_name VARCHAR(100),
    phone VARCHAR(50), company VARCHAR(255), job_title VARCHAR(255),
    capture_method VARCHAR(20) NOT NULL DEFAULT 'manual', capture_source_id VARCHAR(100),
    utm_source VARCHAR(255), utm_medium VARCHAR(255), utm_campaign VARCHAR(255),
    utm_content VARCHAR(255), utm_term VARCHAR(255),
    qualification_score INTEGER, qualification_answers JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, email)
  );
  CREATE TABLE IF NOT EXISTS lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS lead_list_members (
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES lead_lists(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(lead_id, list_id)
  );
  CREATE TABLE IF NOT EXISTS lead_tags (
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL, PRIMARY KEY(lead_id, tag)
  );
  CREATE TABLE IF NOT EXISTS lead_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS lead_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL, type VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, value)
  );
  CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, fields JSONB NOT NULL DEFAULT '[]',
    qualification_config JSONB, redirect_url VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    submission_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS badge_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, event_date DATE,
    qualification_form_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS badge_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES badge_events(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL, first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL, company VARCHAR(255), job_title VARCHAR(255),
    badge_pdf_path VARCHAR(1000), scanned_at TIMESTAMPTZ, lead_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, email)
  );
`;

// ---------------------------------------------------------------------------
// App context
// ---------------------------------------------------------------------------

interface CaptureTestAppContext {
  app: FastifyInstance;
  pgClient: postgres.Sql;
  pgContainer: StartedTestContainer;
  testRedis: TestRedis;
  userId: string;
  sessionCookie: string;
  teardown: () => Promise<void>;
}

async function setupCaptureTestApp(): Promise<CaptureTestAppContext> {
  if (!process.env.PEPPER) process.env.PEPPER = 'test-pepper-secret-32chars!!';

  const pgContainer = await new GenericContainer('postgres:16')
    .withExposedPorts(5432)
    .withEnvironment({ POSTGRES_DB: 'testdb', POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test' })
    .start();

  const host = pgContainer.getHost();
  const port = pgContainer.getMappedPort(5432);
  const pgClient = postgres(`postgresql://test:test@${host}:${port}/testdb`);
  const allSchema = { ...securitySchema, ...leadsSchema, ...captureSchema };
  const db = drizzle(pgClient, { schema: allSchema });
  await pgClient.unsafe(ALL_TABLES_SQL);

  const testRedis = await setupTestRedis();
  const redis = testRedis.redis;

  const usersRepo = new UsersRepository(db as any);
  const sessionService = new SessionService(redis);

  // Leads module
  const leadsRepo = new LeadsRepository(db as any);
  const listsRepo = new ListsRepository(db as any);
  const tagsRepo = new TagsRepository(db as any);
  const notesRepo = new NotesRepository(db as any);
  const blacklistRepo = new BlacklistRepository(db as any);
  const leadsService = new LeadsService(leadsRepo, blacklistRepo, tagsRepo, notesRepo, listsRepo);
  new ListsService(listsRepo, leadsRepo); // wired but not needed in routes

  // Capture module
  const formsRepo = new FormsRepository(db as any);
  const badgeEventsRepo = new BadgeEventsRepository(db as any);
  const formsService = new FormsService(formsRepo, leadsService);
  const badgeService = new BadgeService(badgeEventsRepo, leadsService);
  const csvService = new CsvService(leadsService);

  // Create a test user + session
  const userRow = await pgClient.unsafe<{ id: string }[]>(
    `INSERT INTO users (username, email, password_hash, email_verified)
     VALUES ('captest', 'captest@test.com', '$argon2id$mock', true) RETURNING id`,
  );
  const userId = userRow[0].id;
  const sessionId = await sessionService.createSession({ userId, username: 'captest', authMethod: 'password' });
  const cookieName = process.env.SESSION_COOKIE_NAME || '__session';
  const sessionCookie = `${cookieName}=${sessionId}`;

  const app = Fastify();
  await app.register(cookie);
  await app.register(multipart);

  app.decorate('sessionService', sessionService);
  app.decorate('usersRepo', usersRepo);
  app.decorate('redis', redis);
  app.decorate('formsService', formsService);
  app.decorate('badgeService', badgeService);
  app.decorate('csvService', csvService);
  app.decorate('leadsService', leadsService);

  await app.register(captureRoutes, { prefix: '/capture' });
  await app.ready();

  return {
    app,
    pgClient,
    pgContainer,
    testRedis,
    userId,
    sessionCookie,
    teardown: async () => {
      await app.close();
      await pgClient.end();
      await pgContainer.stop();
      await testRedis.teardown();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MODULE 10.7 — Capture Routes (Integration)', () => {
  let ctx: CaptureTestAppContext;

  beforeAll(async () => {
    ctx = await setupCaptureTestApp();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  });

  beforeEach(async () => {
    await ctx.pgClient.unsafe('DELETE FROM badge_attendees');
    await ctx.pgClient.unsafe('DELETE FROM badge_events');
    await ctx.pgClient.unsafe('DELETE FROM forms');
    await ctx.pgClient.unsafe('DELETE FROM leads');
    await ctx.pgClient.unsafe('DELETE FROM lead_blacklist');
  });

  // ── auth guard ────────────────────────────────────────────────────────────

  it('GET /capture/forms returns 401 without auth cookie', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/capture/forms' });
    expect(res.statusCode).toBe(401);
  });

  // ── Forms ─────────────────────────────────────────────────────────────────

  describe('Forms CRUD', () => {
    it('POST /capture/forms creates a form and returns 201', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Lead Gen Form', fields: [] }),
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.status).toBe('draft');
    });

    it('POST /capture/forms returns 400 for missing name', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ fields: [] }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('GET /capture/forms returns list of forms', async () => {
      await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Form A', fields: [] }),
      });
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /capture/forms/:id returns 200 for own form', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'My Form', fields: [] }),
      });
      const { id } = create.json();
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/capture/forms/${id}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('My Form');
    });

    it('GET /capture/forms/:id returns 404 for non-existent form', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/capture/forms/00000000-0000-0000-0000-000000000000',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(404);
    });

    it('PATCH /capture/forms/:id/publish transitions form to active', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'To Publish', fields: [] }),
      });
      const { id } = create.json();
      const res = await ctx.app.inject({
        method: 'PATCH',
        url: `/capture/forms/${id}/publish`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('active');
    });

    it('PATCH /capture/forms/:id/archive transitions form to archived', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'To Archive', fields: [] }),
      });
      const { id } = create.json();
      const res = await ctx.app.inject({
        method: 'PATCH',
        url: `/capture/forms/${id}/archive`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('archived');
    });

    it('DELETE /capture/forms/:id returns 204 for draft form', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Delete Me', fields: [] }),
      });
      const { id } = create.json();
      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/capture/forms/${id}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(204);
    });

    it('DELETE /capture/forms/:id returns 409 for active form', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Active Form', fields: [] }),
      });
      const { id } = create.json();
      await ctx.app.inject({
        method: 'PATCH',
        url: `/capture/forms/${id}/publish`,
        headers: { cookie: ctx.sessionCookie },
      });
      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/capture/forms/${id}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(409);
    });

    it('GET /capture/forms/:id/qr returns PNG data URL', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'QR Form', fields: [] }),
      });
      const { id } = create.json();
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/capture/forms/${id}/qr`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().qrCode).toMatch(/^data:image\/png;base64,/);
    });
  });

  // ── Public form submission ─────────────────────────────────────────────────

  describe('Public form submission', () => {
    it('POST /capture/forms/:id/submit creates a lead (no auth required)', async () => {
      // Create and publish a form as the test user
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Public Form', fields: [] }),
      });
      const { id } = create.json();
      await ctx.app.inject({
        method: 'PATCH',
        url: `/capture/forms/${id}/publish`,
        headers: { cookie: ctx.sessionCookie },
      });

      // Submit without any auth cookie
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/capture/forms/${id}/submit`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'visitor@example.com', firstName: 'Visitor' }),
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.email).toBe('visitor@example.com');
    });

    it('POST /capture/forms/:id/submit returns 400 for missing email', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Form', fields: [] }),
      });
      const { id } = create.json();
      await ctx.app.inject({
        method: 'PATCH',
        url: `/capture/forms/${id}/publish`,
        headers: { cookie: ctx.sessionCookie },
      });

      const res = await ctx.app.inject({
        method: 'POST',
        url: `/capture/forms/${id}/submit`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ firstName: 'No Email' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('POST /capture/forms/:id/submit returns 422 for blacklisted email', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Form', fields: [] }),
      });
      const { id } = create.json();
      await ctx.app.inject({
        method: 'PATCH',
        url: `/capture/forms/${id}/publish`,
        headers: { cookie: ctx.sessionCookie },
      });

      // Blacklist the email via leads route
      await ctx.pgClient.unsafe(
        `INSERT INTO lead_blacklist (user_id, value, type) VALUES ($1, $2, $3)`,
        [ctx.userId, 'blacklisted@example.com', 'email'],
      );

      const res = await ctx.app.inject({
        method: 'POST',
        url: `/capture/forms/${id}/submit`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'blacklisted@example.com' }),
      });
      expect(res.statusCode).toBe(422);
    });

    it('POST /capture/forms/:id/submit returns 404 for draft form', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Draft', fields: [] }),
      });
      const { id } = create.json();

      const res = await ctx.app.inject({
        method: 'POST',
        url: `/capture/forms/${id}/submit`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'v@example.com' }),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Badge Events ──────────────────────────────────────────────────────────

  describe('Badge Events', () => {
    it('POST /capture/badge-events creates an event and returns 201', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/capture/badge-events',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'SXSW 2026' }),
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBe('SXSW 2026');
    });

    it('GET /capture/badge-events returns list', async () => {
      await ctx.app.inject({
        method: 'POST',
        url: '/capture/badge-events',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Event A' }),
      });
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/capture/badge-events',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('POST /capture/badge-events/:eventId/attendees bulk-inserts and returns count', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/badge-events',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Event' }),
      });
      const { id: eventId } = create.json();

      const res = await ctx.app.inject({
        method: 'POST',
        url: `/capture/badge-events/${eventId}/attendees`,
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({
          attendees: [
            { email: 'a@b.com', firstName: 'A', lastName: 'B' },
            { email: 'c@d.com', firstName: 'C', lastName: 'D' },
          ],
        }),
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().inserted).toBe(2);
    });

    it('POST /capture/badge-events/:eventId/scan/:attendeeId creates lead and returns 201', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/badge-events',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Scan Event' }),
      });
      const { id: eventId } = create.json();

      await ctx.app.inject({
        method: 'POST',
        url: `/capture/badge-events/${eventId}/attendees`,
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ attendees: [{ email: 'scan@test.com', firstName: 'Scan', lastName: 'Test' }] }),
      });
      const attendeesRes = await ctx.app.inject({
        method: 'GET',
        url: `/capture/badge-events/${eventId}/attendees`,
        headers: { cookie: ctx.sessionCookie },
      });
      const [attendee] = attendeesRes.json();

      const res = await ctx.app.inject({
        method: 'POST',
        url: `/capture/badge-events/${eventId}/scan/${attendee.id}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().lead.email).toBe('scan@test.com');
    });

    it('POST scan returns 409 when badge already scanned', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/badge-events',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Double Scan Event' }),
      });
      const { id: eventId } = create.json();
      await ctx.app.inject({
        method: 'POST',
        url: `/capture/badge-events/${eventId}/attendees`,
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ attendees: [{ email: 'ds@test.com', firstName: 'D', lastName: 'S' }] }),
      });
      const attendeesRes = await ctx.app.inject({
        method: 'GET',
        url: `/capture/badge-events/${eventId}/attendees`,
        headers: { cookie: ctx.sessionCookie },
      });
      const [attendee] = attendeesRes.json();

      // First scan
      await ctx.app.inject({
        method: 'POST',
        url: `/capture/badge-events/${eventId}/scan/${attendee.id}`,
        headers: { cookie: ctx.sessionCookie },
      });
      // Second scan
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/capture/badge-events/${eventId}/scan/${attendee.id}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(409);
    });

    it('GET /capture/badge-events/:eventId/attendees returns list', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/badge-events',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Event' }),
      });
      const { id: eventId } = create.json();
      await ctx.app.inject({
        method: 'POST',
        url: `/capture/badge-events/${eventId}/attendees`,
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ attendees: [{ email: 'x@y.com', firstName: 'X', lastName: 'Y' }] }),
      });
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/capture/badge-events/${eventId}/attendees`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });

    it('DELETE /capture/badge-events/:eventId returns 204', async () => {
      const create = await ctx.app.inject({
        method: 'POST',
        url: '/capture/badge-events',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Delete Event' }),
      });
      const { id: eventId } = create.json();
      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/capture/badge-events/${eventId}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  // ── CSV Export ────────────────────────────────────────────────────────────

  describe('CSV Export', () => {
    it('GET /capture/leads/export returns CSV with Content-Type text/csv', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/capture/leads/export',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });

    it('GET /capture/leads/export includes lead data for existing leads', async () => {
      // Create a lead via form submission
      const formCreate = await ctx.app.inject({
        method: 'POST',
        url: '/capture/forms',
        headers: { cookie: ctx.sessionCookie, 'content-type': 'application/json' },
        payload: JSON.stringify({ name: 'Export Form', fields: [] }),
      });
      const { id } = formCreate.json();
      await ctx.app.inject({
        method: 'PATCH',
        url: `/capture/forms/${id}/publish`,
        headers: { cookie: ctx.sessionCookie },
      });
      await ctx.app.inject({
        method: 'POST',
        url: `/capture/forms/${id}/submit`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email: 'export@example.com', firstName: 'Export' }),
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/capture/leads/export',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('export@example.com');
    });
  });
});

/**
 * MODULE 16 — Leads Routes (Integration)
 *
 * Full HTTP integration tests using testcontainers (real PG + real Redis).
 * Tests every endpoint in the leads routes, using fastify.inject().
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import Redis from 'ioredis';
import * as securitySchema from '../../src/security/db/schema.js';
import * as leadsSchema from '../../src/leads/db/schema.js';
import { UsersRepository } from '../../src/security/users/users.repository.js';
import { SessionService } from '../../src/security/session/session.service.js';
import { LeadsRepository } from '../../src/leads/leads.repository.js';
import { ListsRepository } from '../../src/leads/lists.repository.js';
import { TagsRepository } from '../../src/leads/tags.repository.js';
import { NotesRepository } from '../../src/leads/notes.repository.js';
import { BlacklistRepository } from '../../src/leads/blacklist.repository.js';
import { LeadsService } from '../../src/leads/leads.service.js';
import { ListsService } from '../../src/leads/lists.service.js';
import { BlacklistService } from '../../src/leads/blacklist.service.js';
import { leadsRoutes } from '../../src/leads/routes/leads.routes.js';
import { setupTestRedis, type TestRedis } from '../helpers/test-redis.js';

// ---------------------------------------------------------------------------
// Shared app context for leads routes
// ---------------------------------------------------------------------------

const ALL_LEADS_TABLES_SQL = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL, ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT, risk_level VARCHAR(20) NOT NULL, metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL, first_name VARCHAR(100), last_name VARCHAR(100),
    phone VARCHAR(50), company VARCHAR(255), job_title VARCHAR(255),
    capture_method VARCHAR(20) NOT NULL DEFAULT 'manual', capture_source_id VARCHAR(100),
    utm_source VARCHAR(255), utm_medium VARCHAR(255), utm_campaign VARCHAR(255),
    utm_content VARCHAR(255), utm_term VARCHAR(255),
    qualification_score INTEGER, qualification_answers JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, email)
  );
  CREATE TABLE IF NOT EXISTS lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS lead_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL, type VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, value)
  );
`;

interface LeadsTestAppContext {
  app: FastifyInstance;
  pgClient: postgres.Sql;
  pgContainer: StartedTestContainer;
  testRedis: TestRedis;
  userId: string;
  sessionCookie: string;
  teardown: () => Promise<void>;
}

async function setupLeadsTestApp(): Promise<LeadsTestAppContext> {
  if (!process.env.PEPPER) process.env.PEPPER = 'test-pepper-secret-32chars!!';

  const pgContainer = await new GenericContainer('postgres:16')
    .withExposedPorts(5432)
    .withEnvironment({ POSTGRES_DB: 'testdb', POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test' })
    .start();

  const host = pgContainer.getHost();
  const port = pgContainer.getMappedPort(5432);
  const pgClient = postgres(`postgresql://test:test@${host}:${port}/testdb`);
  const allSchema = { ...securitySchema, ...leadsSchema };
  const db = drizzle(pgClient, { schema: allSchema });
  await pgClient.unsafe(ALL_LEADS_TABLES_SQL);

  const testRedis = await setupTestRedis();
  const redis = testRedis.redis;

  const usersRepo = new UsersRepository(db as any);
  const sessionService = new SessionService(redis);
  const leadsRepo = new LeadsRepository(db as any);
  const listsRepo = new ListsRepository(db as any);
  const tagsRepo = new TagsRepository(db as any);
  const notesRepo = new NotesRepository(db as any);
  const blacklistRepo = new BlacklistRepository(db as any);
  const leadsService = new LeadsService(leadsRepo, blacklistRepo, tagsRepo, notesRepo, listsRepo);
  const listsService = new ListsService(listsRepo, leadsRepo);
  const blacklistService = new BlacklistService(blacklistRepo);

  // Create a test user
  const userRow = await pgClient.unsafe<{ id: string }[]>(
    `INSERT INTO users (username, email, password_hash, email_verified)
     VALUES ('routetest', 'routetest@test.com', '$argon2id$mock', true) RETURNING id`,
  );
  const userId = userRow[0].id;

  // Issue a session so routes have an authenticated context
  const sessionId = await sessionService.createSession({ userId, username: 'routetest', authMethod: 'password' });
  const cookieName = process.env.SESSION_COOKIE_NAME || '__session';
  const sessionCookie = `${cookieName}=${sessionId}`;

  const app = Fastify();
  await app.register(cookie);
  app.decorate('usersRepo', usersRepo);
  app.decorate('redis', redis);
  app.decorate('sessionService', sessionService);
  app.decorate('leadsService', leadsService);
  app.decorate('listsService', listsService);
  app.decorate('blacklistService', blacklistService);

  await app.register(leadsRoutes, { prefix: '/leads' });
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

describe('MODULE 16 — Leads Routes (Integration)', () => {
  let ctx: LeadsTestAppContext;

  beforeAll(async () => {
    ctx = await setupLeadsTestApp();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  });

  beforeEach(async () => {
    await ctx.pgClient.unsafe('DELETE FROM lead_list_members');
    await ctx.pgClient.unsafe('DELETE FROM lead_notes');
    await ctx.pgClient.unsafe('DELETE FROM lead_tags');
    await ctx.pgClient.unsafe('DELETE FROM lead_lists');
    await ctx.pgClient.unsafe('DELETE FROM leads');
    await ctx.pgClient.unsafe('DELETE FROM lead_blacklist');
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('GET /leads → 401 without session cookie', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/leads' });
      expect(res.statusCode).toBe(401);
    });

    it('POST /leads → 401 without session cookie', async () => {
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads',
        payload: { email: 'test@example.com' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── POST /leads ────────────────────────────────────────────────────────────

  describe('POST /leads — capture a lead', () => {
    it('201 with valid body → returns lead id and email', async () => {
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'alice@example.com', firstName: 'Alice', company: 'Acme' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.email).toBe('alice@example.com');
    });

    it('400 when required field email is missing', async () => {
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { firstName: 'Alice' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('400 when email is malformed', async () => {
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('409 when lead with same email already exists for this user', async () => {
      await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'dup@example.com' },
      });
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'dup@example.com' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe('DUPLICATE_LEAD');
    });

    it('422 when lead email is blacklisted', async () => {
      await ctx.app.inject({
        method: 'POST', url: '/leads/blacklist',
        headers: { cookie: ctx.sessionCookie },
        payload: { value: 'spam@example.com', type: 'email' },
      });
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'spam@example.com' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error).toBe('BLACKLISTED_LEAD');
    });
  });

  // ── GET /leads ─────────────────────────────────────────────────────────────

  describe('GET /leads — list leads', () => {
    it('200 with empty results when no leads', async () => {
      const res = await ctx.app.inject({
        method: 'GET', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.leads).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('200 returns paginated leads list with total', async () => {
      await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'alice@example.com' },
      });
      const res = await ctx.app.inject({
        method: 'GET', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
      });
      const body = res.json();
      expect(body.leads).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it('pagination: ?limit=2&offset=0 returns at most 2 leads', async () => {
      for (let i = 0; i < 5; i++) {
        await ctx.app.inject({
          method: 'POST', url: '/leads',
          headers: { cookie: ctx.sessionCookie },
          payload: { email: `lead${i}@example.com` },
        });
      }
      const res = await ctx.app.inject({
        method: 'GET', url: '/leads?limit=2&offset=0',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().leads).toHaveLength(2);
    });

    it('filter by status: ?status=contacted', async () => {
      const postRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'alice@example.com' },
      });
      const leadId = postRes.json().id;
      await ctx.app.inject({
        method: 'PATCH', url: `/leads/${leadId}`,
        headers: { cookie: ctx.sessionCookie },
        payload: { status: 'contacted' },
      });
      const res = await ctx.app.inject({
        method: 'GET', url: '/leads?status=contacted',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().leads.every((l: any) => l.status === 'contacted')).toBe(true);
    });
  });

  // ── GET /leads/:id ─────────────────────────────────────────────────────────

  describe('GET /leads/:id — get single lead', () => {
    it('200 returns the lead', async () => {
      const createRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'alice@example.com', firstName: 'Alice' },
      });
      const leadId = createRes.json().id;
      const res = await ctx.app.inject({
        method: 'GET', url: `/leads/${leadId}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe(leadId);
    });

    it('404 when lead does not exist', async () => {
      const res = await ctx.app.inject({
        method: 'GET', url: '/leads/00000000-0000-0000-0000-000000000000',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('LEAD_NOT_FOUND');
    });

    it('404 for lead belonging to a different user (no cross-tenant leak)', async () => {
      // Create a second user and their lead via DB directly
      const other = await ctx.pgClient.unsafe<{ id: string }[]>(
        `INSERT INTO users (username, email, password_hash, email_verified)
         VALUES ('other2', 'other2@test.com', '$argon2id$mock', true) RETURNING id`,
      );
      const otherUserId = other[0].id;
      const lead = await ctx.pgClient.unsafe<{ id: string }[]>(
        `INSERT INTO leads (user_id, email, capture_method) VALUES ('${otherUserId}', 'secret@example.com', 'manual') RETURNING id`,
      );
      const otherLeadId = lead[0].id;
      const res = await ctx.app.inject({
        method: 'GET', url: `/leads/${otherLeadId}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── PATCH /leads/:id ───────────────────────────────────────────────────────

  describe('PATCH /leads/:id — update a lead', () => {
    it('200 updates the specified fields', async () => {
      const createRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'alice@example.com' },
      });
      const leadId = createRes.json().id;
      const res = await ctx.app.inject({
        method: 'PATCH', url: `/leads/${leadId}`,
        headers: { cookie: ctx.sessionCookie },
        payload: { company: 'NewCo', jobTitle: 'Director' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().company).toBe('NewCo');
      expect(res.json().jobTitle).toBe('Director');
    });

    it('400 when status is invalid', async () => {
      const createRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'alice@example.com' },
      });
      const leadId = createRes.json().id;
      const res = await ctx.app.inject({
        method: 'PATCH', url: `/leads/${leadId}`,
        headers: { cookie: ctx.sessionCookie },
        payload: { status: 'not_a_valid_status' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('404 when lead does not exist', async () => {
      const res = await ctx.app.inject({
        method: 'PATCH', url: '/leads/00000000-0000-0000-0000-000000000000',
        headers: { cookie: ctx.sessionCookie },
        payload: { company: 'X' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── DELETE /leads/:id ──────────────────────────────────────────────────────

  describe('DELETE /leads/:id — delete a lead', () => {
    it('204 on successful deletion', async () => {
      const createRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'del@example.com' },
      });
      const leadId = createRes.json().id;
      const res = await ctx.app.inject({
        method: 'DELETE', url: `/leads/${leadId}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(204);
    });

    it('404 when lead does not exist', async () => {
      const res = await ctx.app.inject({
        method: 'DELETE', url: '/leads/00000000-0000-0000-0000-000000000000',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Tags endpoints ─────────────────────────────────────────────────────────

  describe('POST /leads/:id/tags — add a tag', () => {
    it('200 adds a tag to the lead', async () => {
      const createRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'tag@example.com' },
      });
      const leadId = createRes.json().id;
      const res = await ctx.app.inject({
        method: 'POST', url: `/leads/${leadId}/tags`,
        headers: { cookie: ctx.sessionCookie },
        payload: { tag: 'hot' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('404 when lead does not exist', async () => {
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads/00000000-0000-0000-0000-000000000000/tags',
        headers: { cookie: ctx.sessionCookie },
        payload: { tag: 'hot' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /leads/:id/tags/:tag — remove a tag', () => {
    it('204 on successful tag removal', async () => {
      const createRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'tag@example.com' },
      });
      const leadId = createRes.json().id;
      await ctx.app.inject({
        method: 'POST', url: `/leads/${leadId}/tags`,
        headers: { cookie: ctx.sessionCookie },
        payload: { tag: 'hot' },
      });
      const res = await ctx.app.inject({
        method: 'DELETE', url: `/leads/${leadId}/tags/hot`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  // ── Notes endpoints ────────────────────────────────────────────────────────

  describe('GET /leads/:id/notes — list notes', () => {
    it('200 returns empty notes for new lead', async () => {
      const createRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'note@example.com' },
      });
      const leadId = createRes.json().id;
      const res = await ctx.app.inject({
        method: 'GET', url: `/leads/${leadId}/notes`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  describe('POST /leads/:id/notes — add a note', () => {
    it('201 creates a note and returns it', async () => {
      const createRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'note@example.com' },
      });
      const leadId = createRes.json().id;
      const res = await ctx.app.inject({
        method: 'POST', url: `/leads/${leadId}/notes`,
        headers: { cookie: ctx.sessionCookie },
        payload: { body: 'Called this person on 10/04' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().body).toBe('Called this person on 10/04');
    });

    it('400 when body is empty', async () => {
      const createRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'note@example.com' },
      });
      const leadId = createRes.json().id;
      const res = await ctx.app.inject({
        method: 'POST', url: `/leads/${leadId}/notes`,
        headers: { cookie: ctx.sessionCookie },
        payload: { body: '' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── Lists endpoints ────────────────────────────────────────────────────────

  describe('GET /leads/lists — get user lists', () => {
    it('200 returns empty lists initially', async () => {
      const res = await ctx.app.inject({
        method: 'GET', url: '/leads/lists',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  describe('POST /leads/lists — create a list', () => {
    it('201 creates a list and returns it', async () => {
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads/lists',
        headers: { cookie: ctx.sessionCookie },
        payload: { name: 'SXSW 2026' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().name).toBe('SXSW 2026');
    });

    it('400 when name is empty', async () => {
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads/lists',
        headers: { cookie: ctx.sessionCookie },
        payload: { name: '' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /leads/lists/:listId/members — add leads to list', () => {
    it('200 adds leads to the list', async () => {
      const leadRes = await ctx.app.inject({
        method: 'POST', url: '/leads',
        headers: { cookie: ctx.sessionCookie },
        payload: { email: 'member@example.com' },
      });
      const leadId = leadRes.json().id;
      const listRes = await ctx.app.inject({
        method: 'POST', url: '/leads/lists',
        headers: { cookie: ctx.sessionCookie },
        payload: { name: 'My List' },
      });
      const listId = listRes.json().id;
      const res = await ctx.app.inject({
        method: 'POST', url: `/leads/lists/${listId}/members`,
        headers: { cookie: ctx.sessionCookie },
        payload: { leadIds: [leadId] },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('DELETE /leads/lists/:listId — delete a list', () => {
    it('204 on successful list deletion', async () => {
      const listRes = await ctx.app.inject({
        method: 'POST', url: '/leads/lists',
        headers: { cookie: ctx.sessionCookie },
        payload: { name: 'To Delete' },
      });
      const listId = listRes.json().id;
      const res = await ctx.app.inject({
        method: 'DELETE', url: `/leads/lists/${listId}`,
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(204);
    });

    it('404 when list does not exist', async () => {
      const res = await ctx.app.inject({
        method: 'DELETE', url: '/leads/lists/00000000-0000-0000-0000-000000000000',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Blacklist endpoints ────────────────────────────────────────────────────

  describe('POST /leads/blacklist — add to blacklist', () => {
    it('201 adds an email to the blacklist', async () => {
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads/blacklist',
        headers: { cookie: ctx.sessionCookie },
        payload: { value: 'spam@example.com', type: 'email' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('201 adds a domain to the blacklist', async () => {
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads/blacklist',
        headers: { cookie: ctx.sessionCookie },
        payload: { value: 'spammy.com', type: 'domain' },
      });
      expect(res.statusCode).toBe(201);
    });

    it('409 on duplicate blacklist entry', async () => {
      await ctx.app.inject({
        method: 'POST', url: '/leads/blacklist',
        headers: { cookie: ctx.sessionCookie },
        payload: { value: 'spam@example.com', type: 'email' },
      });
      const res = await ctx.app.inject({
        method: 'POST', url: '/leads/blacklist',
        headers: { cookie: ctx.sessionCookie },
        payload: { value: 'spam@example.com', type: 'email' },
      });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('GET /leads/blacklist — list blacklist entries', () => {
    it('200 returns all user blacklist entries', async () => {
      const res = await ctx.app.inject({
        method: 'GET', url: '/leads/blacklist',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  describe('DELETE /leads/blacklist/:value — remove from blacklist', () => {
    it('204 on successful removal', async () => {
      await ctx.app.inject({
        method: 'POST', url: '/leads/blacklist',
        headers: { cookie: ctx.sessionCookie },
        payload: { value: 'rm@example.com', type: 'email' },
      });
      const res = await ctx.app.inject({
        method: 'DELETE', url: '/leads/blacklist/rm@example.com',
        headers: { cookie: ctx.sessionCookie },
      });
      expect(res.statusCode).toBe(204);
    });
  });
});

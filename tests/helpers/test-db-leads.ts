/**
 * Test helper — spins up a real PostgreSQL container via testcontainers.
 * Creates ALL Phase 1/2 tables: users + security_events + full leads module.
 * Used by leads module integration tests.
 */

import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as securitySchema from '../../src/security/db/schema.js';
import * as leadsSchema from '../../src/leads/db/schema.js';

const ALL_SCHEMA = { ...securitySchema, ...leadsSchema };

const CREATE_TABLES_SQL = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(30) NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS security_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    event_type  VARCHAR(50) NOT NULL,
    ip_address  VARCHAR(45) NOT NULL,
    user_agent  TEXT,
    risk_level  VARCHAR(20) NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS leads (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email                 VARCHAR(255) NOT NULL,
    first_name            VARCHAR(100),
    last_name             VARCHAR(100),
    phone                 VARCHAR(50),
    company               VARCHAR(255),
    job_title             VARCHAR(255),
    capture_method        VARCHAR(20) NOT NULL DEFAULT 'manual',
    capture_source_id     VARCHAR(100),
    utm_source            VARCHAR(255),
    utm_medium            VARCHAR(255),
    utm_campaign          VARCHAR(255),
    utm_content           VARCHAR(255),
    utm_term              VARCHAR(255),
    qualification_score   INTEGER,
    qualification_answers JSONB,
    status                VARCHAR(30) NOT NULL DEFAULT 'new',
    captured_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, email)
  );

  CREATE TABLE IF NOT EXISTS lead_lists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS lead_list_members (
    lead_id  UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    list_id  UUID NOT NULL REFERENCES lead_lists(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(lead_id, list_id)
  );

  CREATE TABLE IF NOT EXISTS lead_tags (
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tag     VARCHAR(100) NOT NULL,
    PRIMARY KEY(lead_id, tag)
  );

  CREATE TABLE IF NOT EXISTS lead_notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS lead_blacklist (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    value      VARCHAR(255) NOT NULL,
    type       VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, value)
  );
`;

export type LeadsTestDb = {
  db: PostgresJsDatabase<typeof ALL_SCHEMA>;
  client: postgres.Sql;
  teardown: () => Promise<void>;
  /** Helper: insert a user row and return its id */
  createUser: (overrides?: Partial<{ username: string; email: string }>) => Promise<string>;
};

let _userCounter = 0;

export async function setupLeadsTestDb(): Promise<LeadsTestDb> {
  const container: StartedTestContainer = await new GenericContainer('postgres:16')
    .withExposedPorts(5432)
    .withEnvironment({
      POSTGRES_DB: 'testdb',
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
    })
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const connectionString = `postgresql://test:test@${host}:${port}/testdb`;

  const client = postgres(connectionString);
  const db = drizzle(client, { schema: ALL_SCHEMA });

  await client.unsafe(CREATE_TABLES_SQL);

  async function createUser(overrides: Partial<{ username: string; email: string }> = {}) {
    _userCounter++;
    const n = _userCounter;
    const username = overrides.username ?? `user${n}`;
    const email = overrides.email ?? `user${n}@test.com`;
    const rows = await client.unsafe<{ id: string }[]>(
      `INSERT INTO users (username, email, password_hash, email_verified)
       VALUES ($1, $2, $3, true) RETURNING id`,
      [username, email, '$argon2id$mock'],
    );
    return rows[0].id;
  }

  return {
    db,
    client,
    teardown: async () => {
      await client.end();
      await container.stop();
    },
    createUser,
  };
}

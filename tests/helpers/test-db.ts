/**
 * Test helper — spins up a real PostgreSQL container via testcontainers.
 * Runs Drizzle migrations, provides a ready-to-use db client.
 *
 * Usage in tests:
 *   const { db, teardown } = await setupTestDb();
 *   afterAll(() => teardown());
 */

import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/security/db/schema';

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

  CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    risk_level VARCHAR(20) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

export interface TestDb {
  db: PostgresJsDatabase<typeof schema>;
  client: postgres.Sql;
  teardown: () => Promise<void>;
}

export async function setupTestDb(): Promise<TestDb> {
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
  const db = drizzle(client, { schema });

  // Create tables
  await client.unsafe(CREATE_TABLES_SQL);

  return {
    db,
    client,
    teardown: async () => {
      await client.end();
      await container.stop();
    },
  };
}

/**
 * MODULE 10.5 — Forms Repository (Integration)
 *
 * Tests FormsRepository against a real PostgreSQL container.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import * as captureSchema from '../../src/capture/db/schema.js';
import { FormsRepository } from '../../src/capture/forms.repository.js';

// ---------------------------------------------------------------------------
// DB setup — users + forms tables
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

  CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    fields JSONB NOT NULL DEFAULT '[]',
    qualification_config JSONB,
    redirect_url VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    submission_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

type AllSchema = typeof captureSchema;

let container: StartedTestContainer;
let client: postgres.Sql;
let db: PostgresJsDatabase<AllSchema>;
let repo: FormsRepository;
let userId: string;

async function createUser(username = 'testuser', email = 'test@example.com') {
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
  repo = new FormsRepository(db as any);
}, 120_000);

afterAll(async () => {
  await client.end();
  await container.stop();
});

beforeEach(async () => {
  await client.unsafe('DELETE FROM forms');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MODULE 10.5 — Forms Repository (Integration)', () => {
  it('createForm: inserts a form and returns it with status draft', async () => {
    const form = await repo.createForm({
      userId,
      name: 'Test Form',
      fields: [],
      status: 'draft',
    });
    expect(form.id).toBeDefined();
    expect(form.status).toBe('draft');
    expect(form.name).toBe('Test Form');
    expect(form.submissionCount).toBe(0);
  });

  it('findById: returns form for correct owner', async () => {
    const created = await repo.createForm({ userId, name: 'My Form', fields: [] });
    const found = await repo.findById(userId, created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('findById: returns null for wrong user', async () => {
    const userId2 = await createUser('other', 'other@example.com');
    const form = await repo.createForm({ userId, name: 'Form', fields: [] });
    const found = await repo.findById(userId2, form.id);
    expect(found).toBeNull();
  });

  it('findPublicById: returns active form regardless of owner', async () => {
    const form = await repo.createForm({ userId, name: 'Public Form', fields: [] });
    await repo.updateStatus(userId, form.id, 'active');
    const found = await repo.findPublicById(form.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(form.id);
  });

  it('findPublicById: returns null when form is still draft', async () => {
    const form = await repo.createForm({ userId, name: 'Draft Form', fields: [] });
    const found = await repo.findPublicById(form.id);
    expect(found).toBeNull();
  });

  it('updateForm: updates name and sets updatedAt', async () => {
    const form = await repo.createForm({ userId, name: 'Old Name', fields: [] });
    const updated = await repo.updateForm(userId, form.id, { name: 'New Name' });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New Name');
  });

  it('updateForm: returns null for wrong user', async () => {
    const form = await repo.createForm({ userId, name: 'Form', fields: [] });
    const result = await repo.updateForm('00000000-0000-0000-0000-000000000001', form.id, { name: 'Hack' });
    expect(result).toBeNull();
  });

  it('updateStatus: changes status to active', async () => {
    const form = await repo.createForm({ userId, name: 'Form', fields: [] });
    const updated = await repo.updateStatus(userId, form.id, 'active');
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('active');
  });

  it('updateStatus: returns null for wrong user', async () => {
    const form = await repo.createForm({ userId, name: 'Form', fields: [] });
    const result = await repo.updateStatus('00000000-0000-0000-0000-000000000001', form.id, 'active');
    expect(result).toBeNull();
  });

  it('deleteForm: removes the row', async () => {
    const form = await repo.createForm({ userId, name: 'Form', fields: [] });
    const deleted = await repo.deleteForm(userId, form.id);
    expect(deleted).toBe(true);
    const found = await repo.findById(userId, form.id);
    expect(found).toBeNull();
  });

  it('deleteForm: returns false for wrong user', async () => {
    const form = await repo.createForm({ userId, name: 'Form', fields: [] });
    const result = await repo.deleteForm('00000000-0000-0000-0000-000000000001', form.id);
    expect(result).toBe(false);
  });

  it('listByUser: returns only forms belonging to that user', async () => {
    const userId2 = await createUser('u2', 'u2@example.com');
    await repo.createForm({ userId, name: 'Form A', fields: [] });
    await repo.createForm({ userId, name: 'Form B', fields: [] });
    await repo.createForm({ userId: userId2, name: 'Other User Form', fields: [] });

    const forms = await repo.listByUser(userId);
    expect(forms).toHaveLength(2);
    forms.forEach(f => expect(f.userId).toBe(userId));
  });

  it('listByUser: filters by status', async () => {
    await repo.createForm({ userId, name: 'Draft', fields: [] });
    const form2 = await repo.createForm({ userId, name: 'Active', fields: [] });
    await repo.updateStatus(userId, form2.id, 'active');

    const drafts = await repo.listByUser(userId, 'draft');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe('Draft');
  });

  it('incrementSubmissionCount: atomically increments counter', async () => {
    const form = await repo.createForm({ userId, name: 'Form', fields: [] });
    await repo.incrementSubmissionCount(form.id);
    await repo.incrementSubmissionCount(form.id);
    const updated = await repo.findById(userId, form.id);
    expect(updated!.submissionCount).toBe(2);
  });
});

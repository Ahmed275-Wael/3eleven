# Database Setup Plan — Containers, Schema, Connection Verification

> **Status:** PLAN ONLY — do not implement until reviewed and approved.

---

## Overview

We need **two** databases running in Docker containers for local development and test execution:

| DB | Image | Port (host) | Purpose |
|----|-------|-------------|---------|
| PostgreSQL 16 | `postgres:16-alpine` | `5432` | Users, security events (persistent) |
| Redis 7 | `redis:7-alpine` | `6379` | Sessions, codes, rate limits (ephemeral) |

**Three layers of DB setup:**

1. **Dev containers** — `docker-compose.yml` for local development (you start once, keep running)
2. **Schema creation** — Drizzle migrations create tables from `src/security/db/schema.ts`
3. **Connection verification** — A script that confirms both DBs are reachable + schema is applied
4. **Test containers** — Testcontainers (already in `tests/helpers/`) spin up disposable containers per test suite

---

## Part 1: docker-compose.yml

**File:** `docker-compose.yml` (project root)

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: leadgen_postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: leadgen
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d leadgen"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: leadgen_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
  redisdata:
```

**What this does:**
- PostgreSQL on `localhost:5432` with database `leadgen`, user `postgres`, password `postgres`
- Redis on `localhost:6379` with no auth (dev only)
- Persistent volumes so data survives `docker-compose stop`
- Health checks so `docker-compose up --wait` blocks until both are ready
- Alpine images for smaller footprint

---

## Part 2: .env File (Dev Defaults)

**File:** `.env` (copy from `.env.example`, gitignored)

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leadgen
REDIS_URL=redis://localhost:6379

PEPPER=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
SESSION_COOKIE_NAME=__session

SMTP_HOST=localhost
SMTP_PORT=2525
SMTP_USER=
SMTP_PASS=
```

> Note: The PEPPER value above is for dev ONLY. Production must use a cryptographically random 64-char hex string.

---

## Part 3: Schema Creation via Drizzle Migrations

**Strategy:** Use Drizzle Kit to generate SQL migrations from our schema, then apply them.

### Step 3a: Generate migrations

```bash
npx drizzle-kit generate
```

This reads `drizzle.config.ts` → reads `src/security/db/schema.ts` → outputs SQL files to `./drizzle/` folder.

**Expected output:** A migration file like `drizzle/0000_create_tables.sql` containing:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "username" varchar(30) NOT NULL UNIQUE,
  "email" varchar(255) NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "email_verified" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "security_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id"),
  "event_type" varchar(50) NOT NULL,
  "ip_address" varchar(45) NOT NULL,
  "user_agent" text,
  "risk_level" varchar(20) NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
```

### Step 3b: Apply migrations

```bash
npx drizzle-kit migrate
```

This connects to `DATABASE_URL` and runs all pending migrations.

### Alternative: Push (dev shortcut)

```bash
npx drizzle-kit push
```

Pushes schema directly without generating migration files. Useful for rapid dev iteration, but we'll use `generate` + `migrate` for tracking.

---

## Part 4: Connection Verification Script

**File:** `scripts/verify-db-connections.ts`

A standalone script that:
1. Connects to PostgreSQL via `DATABASE_URL`
2. Verifies the `users` and `security_events` tables exist
3. Connects to Redis via `REDIS_URL`
4. Verifies Redis responds to PING
5. Exits 0 on success, 1 on failure with clear error messages

```typescript
/**
 * scripts/verify-db-connections.ts
 *
 * Verifies PostgreSQL and Redis are reachable and schema is applied.
 * Run: npx tsx scripts/verify-db-connections.ts
 */
import postgres from 'postgres';
import Redis from 'ioredis';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/leadgen';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function verifyPostgres(): Promise<void> {
  console.log('🔌 Connecting to PostgreSQL...');
  const sql = postgres(DATABASE_URL);

  try {
    // Basic connectivity
    const [{ now }] = await sql`SELECT now()`;
    console.log(`✅ PostgreSQL connected — server time: ${now}`);

    // Verify tables exist
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'security_events')
      ORDER BY table_name
    `;

    const tableNames = tables.map((t: any) => t.table_name);
    if (tableNames.includes('users') && tableNames.includes('security_events')) {
      console.log(`✅ Tables found: ${tableNames.join(', ')}`);
    } else {
      console.error(`❌ Missing tables. Found: [${tableNames.join(', ')}]. Expected: [users, security_events]`);
      console.error('   Run: npx drizzle-kit migrate');
      process.exit(1);
    }

    // Verify column structure (spot-check)
    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;
    const colNames = columns.map((c: any) => c.column_name);
    const expectedCols = ['id', 'username', 'email', 'password_hash', 'email_verified', 'created_at', 'updated_at', 'deleted_at'];
    const missing = expectedCols.filter(c => !colNames.includes(c));
    if (missing.length > 0) {
      console.error(`❌ users table missing columns: ${missing.join(', ')}`);
      process.exit(1);
    }
    console.log(`✅ users table schema verified (${colNames.length} columns)`);

    await sql.end();
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', (err as Error).message);
    console.error('   Is the container running? → docker compose up -d postgres');
    process.exit(1);
  }
}

async function verifyRedis(): Promise<void> {
  console.log('🔌 Connecting to Redis...');
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });

  try {
    const pong = await redis.ping();
    console.log(`✅ Redis connected — PING: ${pong}`);

    // Verify basic operations work
    await redis.set('__healthcheck', 'ok', 'EX', 5);
    const val = await redis.get('__healthcheck');
    if (val === 'ok') {
      console.log('✅ Redis read/write verified');
    } else {
      console.error('❌ Redis read/write failed');
      process.exit(1);
    }
    await redis.del('__healthcheck');

    // Show info
    const info = await redis.info('server');
    const versionMatch = info.match(/redis_version:(.+)/);
    if (versionMatch) {
      console.log(`✅ Redis version: ${versionMatch[1].trim()}`);
    }

    await redis.quit();
  } catch (err) {
    console.error('❌ Redis connection failed:', (err as Error).message);
    console.error('   Is the container running? → docker compose up -d redis');
    process.exit(1);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Database Connection Verification');
  console.log('═══════════════════════════════════════════════\n');

  await verifyPostgres();
  console.log('');
  await verifyRedis();

  console.log('\n═══════════════════════════════════════════════');
  console.log('  ✅ All database connections verified!');
  console.log('═══════════════════════════════════════════════');
}

main();
```

---

## Part 5: NPM Scripts to Add

Add to `package.json` scripts:

```jsonc
{
  "scripts": {
    // ... existing scripts ...
    "db:up":       "docker compose up -d --wait",
    "db:down":     "docker compose down",
    "db:reset":    "docker compose down -v && docker compose up -d --wait && npx drizzle-kit migrate",
    "db:verify":   "npx tsx scripts/verify-db-connections.ts",
    "db:setup":    "npm run db:up && npx drizzle-kit generate && npx drizzle-kit migrate && npm run db:verify"
  }
}
```

| Script | What It Does |
|--------|-------------|
| `npm run db:up` | Starts both containers, waits for healthchecks to pass |
| `npm run db:down` | Stops containers (data preserved in volumes) |
| `npm run db:reset` | Destroys volumes + containers, recreates fresh, runs migrations |
| `npm run db:verify` | Checks both DBs reachable + schema applied |
| `npm run db:setup` | Full first-time setup: containers → generate → migrate → verify |

---

## Part 6: Test Containers (Already Exist — Minor Refinements)

The test helpers already handle disposable containers:

- **`tests/helpers/test-db.ts`** — Spins up `postgres:16`, creates tables via raw SQL, returns Drizzle client
- **`tests/helpers/test-redis.ts`** — Spins up `redis:7`, returns ioredis client

### Refinements needed:

| File | What to Change | Why |
|------|---------------|-----|
| `tests/helpers/test-db.ts` | Replace raw `CREATE_TABLES_SQL` with Drizzle migration push | Single source of truth — schema.ts drives both dev and test table creation. Avoids drift between the raw SQL we wrote manually and what Drizzle generates. |
| `tests/helpers/test-db.ts` | Add `pg_isready` wait strategy | More reliable startup than just `.start()` |
| `tests/helpers/test-redis.ts` | Add `Wait.forLogMessage("Ready to accept connections")` | More reliable than bare `.start()` |

### Proposed test-db.ts changes:

```typescript
// OPTION A: Use drizzle-orm push (no raw SQL needed)
import { migrate } from 'drizzle-orm/postgres-js/migrator';

export async function setupTestDb(): Promise<TestDb> {
  const container = await new GenericContainer('postgres:16-alpine')
    .withExposedPorts(5432)
    .withEnvironment({
      POSTGRES_DB: 'testdb',
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
    })
    .withWaitStrategy(Wait.forHealthCheck())
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const connectionString = `postgresql://test:test@${host}:${port}/testdb`;

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  // Create schema from Drizzle models (single source of truth)
  await client.unsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await migrate(db, { migrationsFolder: './drizzle' });
  // OR use push approach:
  // await client.unsafe(CREATE_TABLES_SQL);  ← current approach works too

  return { db, client, teardown: async () => { await client.end(); await container.stop(); } };
}
```

**Decision to make:** Keep raw SQL (simpler, no migration folder dependency during tests) or use Drizzle push (single source of truth). Recommendation: **Keep raw SQL for now** — it's faster and test-isolated. We'll sync it if schema changes.

---

## Part 7: Execution Order

```
Step 1: Create docker-compose.yml
Step 2: Create .env from .env.example (update values)
Step 3: Create scripts/verify-db-connections.ts
Step 4: Update package.json with new scripts
Step 5: Run `npm run db:up` → confirm containers start
Step 6: Run `npx drizzle-kit generate` → confirm migration SQL generated
Step 7: Run `npx drizzle-kit migrate` → confirm tables created
Step 8: Run `npm run db:verify` → confirm both connections + schema
Step 9: Run `npm run test` → confirm unit tests still pass (no container needed)
Step 10: (Optional) Run one integration test to verify testcontainers work
```

---

## Part 8: Prerequisites Checklist

Before running anything:

- [ ] **Docker Desktop** installed and running (or Docker Engine on Linux)
- [ ] Ports `5432` and `6379` free on localhost
- [ ] `.env` file created from `.env.example`
- [ ] `npm install` already done (all deps present)

---

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| **CREATE** | `docker-compose.yml` | Dev containers for PostgreSQL + Redis |
| **CREATE** | `scripts/verify-db-connections.ts` | Connection + schema verification script |
| **CREATE** | `.env` | Local env vars (from .env.example) |
| **MODIFY** | `package.json` | Add `db:up`, `db:down`, `db:reset`, `db:verify`, `db:setup` scripts |
| **MODIFY** | `.gitignore` | Add `scripts/*.log` if needed |
| **NO CHANGE** | `tests/helpers/test-db.ts` | Keep as-is for now (raw SQL approach works) |
| **NO CHANGE** | `tests/helpers/test-redis.ts` | Keep as-is |
| **NO CHANGE** | `drizzle.config.ts` | Already correct |
| **NO CHANGE** | `src/security/db/schema.ts` | Already correct |

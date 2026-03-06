/**
 * scripts/verify-db-connections.ts
 *
 * Verifies PostgreSQL and Redis are reachable and schema is applied.
 * Run: npx tsx scripts/verify-db-connections.ts
 */
import postgres from 'postgres';
import Redis from 'ioredis';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/leadgen';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function verifyPostgres(): Promise<void> {
  console.log('Connecting to PostgreSQL...');
  const sql = postgres(DATABASE_URL);

  try {
    const [{ now }] = await sql`SELECT now()`;
    console.log(`[OK] PostgreSQL connected — server time: ${now}`);

    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'security_events')
      ORDER BY table_name
    `;

    const tableNames = tables.map((t: { table_name: string }) => t.table_name);
    if (tableNames.includes('users') && tableNames.includes('security_events')) {
      console.log(`[OK] Tables found: ${tableNames.join(', ')}`);
    } else {
      console.error(`[FAIL] Missing tables. Found: [${tableNames.join(', ')}]. Expected: [users, security_events]`);
      console.error('   Run: npx drizzle-kit migrate');
      process.exit(1);
    }

    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;
    const colNames = columns.map((c: { column_name: string }) => c.column_name);
    const expectedCols = ['id', 'username', 'email', 'password_hash', 'email_verified', 'created_at', 'updated_at', 'deleted_at'];
    const missing = expectedCols.filter(c => !colNames.includes(c));
    if (missing.length > 0) {
      console.error(`[FAIL] users table missing columns: ${missing.join(', ')}`);
      process.exit(1);
    }
    console.log(`[OK] users table schema verified (${colNames.length} columns)`);

    await sql.end();
  } catch (err) {
    console.error('[FAIL] PostgreSQL connection failed:', (err as Error).message);
    console.error('   Is the container running? -> docker compose up -d postgres');
    process.exit(1);
  }
}

async function verifyRedis(): Promise<void> {
  console.log('Connecting to Redis...');
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });

  try {
    const pong = await redis.ping();
    console.log(`[OK] Redis connected — PING: ${pong}`);

    await redis.set('__healthcheck', 'ok', 'EX', 5);
    const val = await redis.get('__healthcheck');
    if (val === 'ok') {
      console.log('[OK] Redis read/write verified');
    } else {
      console.error('[FAIL] Redis read/write failed');
      process.exit(1);
    }
    await redis.del('__healthcheck');

    const info = await redis.info('server');
    const versionMatch = info.match(/redis_version:(.+)/);
    if (versionMatch) {
      console.log(`[OK] Redis version: ${versionMatch[1].trim()}`);
    }

    await redis.quit();
  } catch (err) {
    console.error('[FAIL] Redis connection failed:', (err as Error).message);
    console.error('   Is the container running? -> docker compose up -d redis');
    process.exit(1);
  }
}

async function main() {
  console.log('===============================================');
  console.log('  Database Connection Verification');
  console.log('===============================================\n');

  await verifyPostgres();
  console.log('');
  await verifyRedis();

  console.log('\n===============================================');
  console.log('  All database connections verified!');
  console.log('===============================================');
}

main();

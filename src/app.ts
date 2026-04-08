// Application Bootstrap — wires Fastify + DB + Redis + Email + Routes

import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import Redis from 'ioredis';
import * as schema from './security/db/schema.js';
import { UsersRepository } from './security/users/users.repository.js';
import { SessionService } from './security/session/session.service.js';
import { SmtpEmailSender } from './security/email/smtp-sender.js';
import { SecurityEventsRepository } from './security/risk/security-events.repository.js';
import { authRoutes } from './security/routes/auth.routes.js';

export interface AppConfig {
  port?: number;
  host?: string;
  databaseUrl?: string;
  redisUrl?: string;
}

export async function buildApp(config?: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // ── Cookie parser ──
  await app.register(cookie);

  // ── PostgreSQL + Drizzle ──
  const databaseUrl = config?.databaseUrl ?? process.env.DATABASE_URL!;
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  // ── Redis ──
  const redisUrl = config?.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl);

  // ── Services ──
  const usersRepo = new UsersRepository(db);
  const sessionService = new SessionService(redis);
  const emailSender = new SmtpEmailSender();
  const eventsRepo = new SecurityEventsRepository(db);

  // ── Decorate app with dependencies ──
  app.decorate('usersRepo', usersRepo);
  app.decorate('redis', redis);
  app.decorate('sessionService', sessionService);
  app.decorate('emailSender', emailSender);
  app.decorate('resetEmailSender', emailSender); // same sender, implements both interfaces
  app.decorate('eventsRepo', eventsRepo);

  // ── Routes ──
  await app.register(authRoutes);

  // ── Graceful shutdown ──
  app.addHook('onClose', async () => {
    await redis.quit();
    await client.end();
  });

  return app;
}

// ── Start server when run directly ──
async function main() {
  const app = await buildApp();
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
  console.log(`Server listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

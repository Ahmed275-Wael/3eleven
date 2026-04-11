// Application Bootstrap — wires Fastify + DB + Redis + Email + Routes

import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import Redis from 'ioredis';
import * as schema from './security/db/schema.js';
import * as leadsSchema from './leads/db/schema.js';
import * as captureSchema from './capture/db/schema.js';
import { UsersRepository } from './security/users/users.repository.js';
import { SessionService } from './security/session/session.service.js';
import { SmtpEmailSender } from './security/email/smtp-sender.js';
import { SecurityEventsRepository } from './security/risk/security-events.repository.js';
import { authRoutes } from './security/routes/auth.routes.js';
import { LeadsRepository } from './leads/leads.repository.js';
import { BlacklistRepository } from './leads/blacklist.repository.js';
import { TagsRepository } from './leads/tags.repository.js';
import { NotesRepository } from './leads/notes.repository.js';
import { ListsRepository } from './leads/lists.repository.js';
import { LeadsService } from './leads/leads.service.js';
import { ListsService } from './leads/lists.service.js';
import { BlacklistService } from './leads/blacklist.service.js';
import { leadsRoutes } from './leads/routes/leads.routes.js';
import { FormsRepository } from './capture/forms.repository.js';
import { BadgeEventsRepository } from './capture/badge-events.repository.js';
import { FormsService } from './capture/forms.service.js';
import { BadgeService } from './capture/badge.service.js';
import { CsvService } from './capture/csv.service.js';
import { captureRoutes } from './capture/routes/capture.routes.js';

export interface AppConfig {
  port?: number;
  host?: string;
  databaseUrl?: string;
  redisUrl?: string;
}

export async function buildApp(config?: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: {
        paths: [
          'req.body.password',
          'req.body.newPassword',
          'req.body.code',
          'req.headers.authorization',
          'req.headers.cookie',
        ],
        censor: '[REDACTED]',
      },
    },
  });

  // ── Cookie parser ──
  await app.register(cookie);

  // ── Multipart (CSV file upload) ──
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

  // ── PostgreSQL + Drizzle ──
  const databaseUrl = config?.databaseUrl ?? process.env.DATABASE_URL!;
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });
  const leadsDb = drizzle(client, { schema: leadsSchema });
  const captureDb = drizzle(client, { schema: captureSchema });

  // ── Redis ──
  const redisUrl = config?.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl);

  // ── Services ──
  const usersRepo = new UsersRepository(db);
  const sessionService = new SessionService(redis);
  const emailSender = new SmtpEmailSender();
  const eventsRepo = new SecurityEventsRepository(db);

  // ── Leads services ──
  const leadsRepo = new LeadsRepository(leadsDb);
  const blacklistRepo = new BlacklistRepository(leadsDb);
  const tagsRepo = new TagsRepository(leadsDb);
  const notesRepo = new NotesRepository(leadsDb);
  const listsRepo = new ListsRepository(leadsDb);
  const leadsService = new LeadsService(leadsRepo, blacklistRepo, tagsRepo, notesRepo, listsRepo);
  const listsService = new ListsService(listsRepo, leadsRepo);
  const blacklistService = new BlacklistService(blacklistRepo);

  // ── Capture services ──
  const formsRepo = new FormsRepository(captureDb);
  const badgeRepo = new BadgeEventsRepository(captureDb);
  const formsService = new FormsService(formsRepo, leadsService);
  const badgeService = new BadgeService(badgeRepo, leadsService);
  const csvService = new CsvService(leadsService);

  // ── Decorate app with dependencies ──
  app.decorate('usersRepo', usersRepo);
  app.decorate('redis', redis);
  app.decorate('sessionService', sessionService);
  app.decorate('emailSender', emailSender);
  app.decorate('resetEmailSender', emailSender); // same sender, implements both interfaces
  app.decorate('eventsRepo', eventsRepo);
  app.decorate('leadsService', leadsService);
  app.decorate('listsService', listsService);
  app.decorate('blacklistService', blacklistService);
  app.decorate('formsService', formsService);
  app.decorate('badgeService', badgeService);
  app.decorate('csvService', csvService);

  // ── Routes ──
  await app.register(authRoutes);
  await app.register(leadsRoutes, { prefix: '/leads' });
  await app.register(captureRoutes, { prefix: '/capture' });

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

/**
 * Test helper — builds a fully wired Fastify app using testcontainers
 * (real PostgreSQL + real Redis + in-process SMTP capture).
 *
 * Usage in integration/e2e tests:
 *   const ctx = await setupTestApp();
 *   afterAll(() => ctx.teardown());
 *   const res = await ctx.app.inject({ method: 'POST', url: '/auth/register', ... });
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import Redis from 'ioredis';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/security/db/schema';
import { UsersRepository } from '../../src/security/users/users.repository';
import { SessionService } from '../../src/security/session/session.service';
import { authRoutes } from '../../src/security/routes/auth.routes';
import { setupTestDb, type TestDb } from './test-db';
import { setupTestRedis, type TestRedis } from './test-redis';
import { setupTestSmtp, type TestSmtp } from './test-smtp';
import type { EmailSender } from '../../src/security/auth/registration.service';
import type { ResetEmailSender } from '../../src/security/auth/password-reset.service';
import { SecurityEventsRepository } from '../../src/security/risk/security-events.repository';

export interface TestAppContext {
  app: FastifyInstance;
  testDb: TestDb;
  testRedis: TestRedis;
  testSmtp: TestSmtp;
  redis: Redis;
  usersRepo: UsersRepository;
  sessionService: SessionService;
  teardown: () => Promise<void>;
}

/** SMTP email sender that sends through the test SMTP server */
class TestSmtpSender implements EmailSender, ResetEmailSender {
  constructor(private readonly port: number) {}

  private async send(to: string, subject: string, text: string): Promise<void> {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport({
      host: '127.0.0.1',
      port: this.port,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
    await transport.sendMail({
      from: 'test@leadgen.local',
      to,
      subject,
      text,
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    await this.send(email, 'Verification Code', `Your code: ${code}`);
  }

  async sendResetCode(email: string, code: string): Promise<void> {
    await this.send(email, 'Password Reset Code', `Your reset code: ${code}`);
  }
}

export async function setupTestApp(): Promise<TestAppContext> {
  // Ensure PEPPER is set for argon2 hashing
  if (!process.env.PEPPER) {
    process.env.PEPPER = 'test-pepper-secret-32chars!!';
  }

  // Spin up real containers + SMTP
  const [testDb, testRedis, testSmtp] = await Promise.all([
    setupTestDb(),
    setupTestRedis(),
    setupTestSmtp(),
  ]);

  const redis = testRedis.redis;
  const usersRepo = new UsersRepository(testDb.db);
  const sessionService = new SessionService(redis);
  const emailSender = new TestSmtpSender(testSmtp.port);
  const eventsRepo = new SecurityEventsRepository(testDb.db);

  const app = Fastify();
  await app.register(cookie);

  // Decorate with real services
  app.decorate('usersRepo', usersRepo);
  app.decorate('redis', redis);
  app.decorate('sessionService', sessionService);
  app.decorate('emailSender', emailSender);
  app.decorate('resetEmailSender', emailSender);
  app.decorate('eventsRepo', eventsRepo);

  await app.register(authRoutes);
  await app.ready();

  return {
    app,
    testDb,
    testRedis,
    testSmtp,
    redis,
    usersRepo,
    sessionService,
    teardown: async () => {
      try { await app.close(); } catch { /* ignore */ }
      await testSmtp.teardown();
      await testRedis.teardown();
      await testDb.teardown();
    },
  };
}

// Auth Routes — Fastify route registration

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import rateLimit from '@fastify/rate-limit';
import { RegistrationService } from '../auth/registration.service.js';
import { EmailVerificationService } from '../auth/email-verification.service.js';
import { LoginService } from '../auth/login.service.js';
import { PasswordResetService } from '../auth/password-reset.service.js';
import { SessionService } from '../session/session.service.js';
import { setSessionCookie, clearSessionCookie } from '../session/session.cookie.js';
import { requireAuth, setSessionServiceForAuth } from '../middleware/require-auth.js';
import { SecurityError } from '../errors/index.js';

// Zod schemas
const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const resendSchema = z.object({
  email: z.string().email(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const verifyResetCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Register rate limiting plugin (Redis-backed when available, per-route opt-in)
  // Retrieve pre-configured services from app decorators
  const usersRepo = (app as any).usersRepo;
  const redis = (app as any).redis;

  // Register rate limiting plugin (Redis-backed when available, per-route opt-in)
  const rateLimitOpts: Record<string, unknown> = {
    global: false,
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (request: { headers: Record<string, unknown>; ip: string }) => {
      return request.headers['x-forwarded-for'] as string || request.ip;
    },
  };
  if (redis) {
    rateLimitOpts.redis = redis;
  }
  await app.register(rateLimit, rateLimitOpts);
  const sessionService: SessionService = (app as any).sessionService ?? new SessionService(redis);
  const emailSender = (app as any).emailSender ?? { sendVerificationCode: async () => {} };
  const resetEmailSender = (app as any).resetEmailSender ?? { sendResetCode: async () => {} };

  const registrationService = new RegistrationService(usersRepo, redis, emailSender);
  const emailVerificationService = new EmailVerificationService(usersRepo, redis, sessionService, emailSender);
  const eventsRepo = (app as any).eventsRepo;
  const loginService = new LoginService(usersRepo, sessionService, eventsRepo);
  const passwordResetService = new PasswordResetService(usersRepo, redis, sessionService, resetEmailSender);

  setSessionServiceForAuth(sessionService);

  // Error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof SecurityError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }
    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
    // Handle Zod validation errors
    if (error.name === 'ZodError' || (error as any).issues) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }
    // Preserve status codes from rate-limit and other Fastify plugins
    if (error.statusCode && error.statusCode !== 500) {
      return reply.status(error.statusCode).send({
        error: error.code ?? error.message,
        message: error.message,
      });
    }
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  // POST /auth/register
  app.post('/auth/register', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await registrationService.register(body);
    return reply.status(201).send({
      userId: result.userId,
      username: result.username,
      message: 'Verification code sent to your email',
    });
  });

  // POST /auth/verify-email
  app.post('/auth/verify-email', async (request, reply) => {
    const body = verifyEmailSchema.parse(request.body);
    const sessionId = await emailVerificationService.verifyEmail(body);
    setSessionCookie(reply, sessionId);
    return reply.status(200).send({ message: 'Email verified' });
  });

  // POST /auth/resend-verification
  app.post('/auth/resend-verification', async (request, reply) => {
    const body = resendSchema.parse(request.body);
    await emailVerificationService.resendVerification(body.email);
    return reply.status(200).send({ message: 'Verification code resent' });
  });

  // POST /auth/login
  app.post('/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
      || request.ip
      || '0.0.0.0';
    const userAgent = request.headers['user-agent'];
    const sessionId = await loginService.login({ ...body, ip, userAgent });
    setSessionCookie(reply, sessionId);
    return reply.status(200).send({ message: 'Logged in' });
  });

  // POST /auth/logout
  app.post('/auth/logout', async (request, reply) => {
    const cookieName = process.env.SESSION_COOKIE_NAME || '__session';
    const sessionId = request.cookies?.[cookieName];
    clearSessionCookie(reply);
    if (!sessionId) {
      return reply.status(200).send({ loggedOut: false, message: 'No active session' });
    }
    const destroyed = await sessionService.destroySession(sessionId);
    if (destroyed) {
      return reply.status(200).send({ loggedOut: true, message: 'Logged out successfully' });
    }
    return reply.status(200).send({ loggedOut: false, message: 'Session already expired' });
  });

  // POST /auth/forgot-password
  app.post('/auth/forgot-password', {
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);
    await passwordResetService.requestReset(body.email);
    return reply.status(200).send({ message: 'If the email exists, a reset code has been sent' });
  });

  // POST /auth/verify-reset-code  (Step 2 — validate code without consuming it)
  app.post('/auth/verify-reset-code', async (request, reply) => {
    const body = verifyResetCodeSchema.parse(request.body);
    await passwordResetService.verifyResetCode(body.email, body.code);
    return reply.status(200).send({ valid: true, message: 'Code is valid' });
  });

  // POST /auth/reset-password
  app.post('/auth/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);
    await passwordResetService.resetPassword(body.email, body.code, body.newPassword);
    return reply.status(200).send({ message: 'Password reset successful' });
  });
}

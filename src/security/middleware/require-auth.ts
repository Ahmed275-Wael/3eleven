// MODULE 3.3 — requireAuth Middleware

import type { FastifyRequest, FastifyReply } from 'fastify';
import { SessionService, type SessionPayload } from '../session/session.service.js';
import { UnauthenticatedError } from '../errors/index.js';

// Augment Fastify request to carry user
declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionPayload;
  }
}

let _sessionService: SessionService | null = null;

export function setSessionServiceForAuth(service: SessionService): void {
  _sessionService = service;
}

export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!_sessionService) throw new UnauthenticatedError();

  const cookieName = process.env.SESSION_COOKIE_NAME || '__session';
  const sessionId = request.cookies?.[cookieName];

  if (!sessionId) throw new UnauthenticatedError();

  const session = await _sessionService.getSession(sessionId);
  if (!session) throw new UnauthenticatedError();

  request.user = session;
}

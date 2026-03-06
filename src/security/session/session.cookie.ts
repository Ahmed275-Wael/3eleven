// MODULE 3.2 — Session Cookie Helpers

import type { FastifyReply } from 'fastify';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || '__session';
const MAX_AGE = 604800; // 7 days in seconds

export function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  reply.setCookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.setCookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

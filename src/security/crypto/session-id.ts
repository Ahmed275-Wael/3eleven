// MODULE 1.1 — Session ID Generator

import { randomBytes } from 'node:crypto';

export function generateSessionId(): string {
  return randomBytes(32).toString('base64url');
}

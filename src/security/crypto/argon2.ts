// MODULE 1.2 — Argon2id Password Hasher

import { createHmac } from 'node:crypto';
import * as argon2 from 'argon2';
import { MissingPepperError } from '../errors/index.js';

function getPepper(): string {
  const pepper = process.env.PEPPER;
  if (!pepper) throw new MissingPepperError();
  return pepper;
}

function applyPepper(plain: string): Buffer {
  const pepper = getPepper();
  return createHmac('sha256', pepper).update(plain).digest();
}

export async function hashPassword(plain: string): Promise<string> {
  const peppered = applyPepper(plain);
  return argon2.hash(peppered, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const peppered = applyPepper(plain);
  return argon2.verify(hash, peppered);
}

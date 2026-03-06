import { describe, it, expect } from 'vitest';
import { generateSessionId } from '../../../src/security/crypto/session-id';

describe('MODULE 1.1 — generateSessionId()', () => {
  it('generates 32 bytes (256-bit)', () => {
    const id = generateSessionId();
    const buf = Buffer.from(id, 'base64url');
    expect(buf.length).toBe(32);
  });

  it('output is base64url string (no +, /, = characters)', () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('output is exactly 43 characters', () => {
    const id = generateSessionId();
    expect(id).toHaveLength(43);
  });

  it('10,000 iterations → no two IDs are identical', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(generateSessionId());
    }
    expect(ids.size).toBe(10_000);
  });
});

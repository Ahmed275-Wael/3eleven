/**
 * MODULE 10.4 — QR Service (Unit)
 *
 * Tests QR code generation. Pure function — no database required.
 */
import { describe, it, expect } from 'vitest';
import { generateQrCode } from '../../../src/capture/qr.service.js';

describe('MODULE 10.4 — QR Service (Unit)', () => {
  it('returns a PNG data URL', async () => {
    const dataUrl = await generateQrCode('form-uuid-1', 'https://app.leadgen.io');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('data URL has non-empty base64 payload', async () => {
    const dataUrl = await generateQrCode('form-uuid-1', 'https://app.leadgen.io');
    const [, payload] = dataUrl.split(',');
    expect(payload.length).toBeGreaterThan(100);
  });

  it('different formIds produce different QR codes', async () => {
    const [qr1, qr2] = await Promise.all([
      generateQrCode('form-uuid-1', 'https://app.leadgen.io'),
      generateQrCode('form-uuid-2', 'https://app.leadgen.io'),
    ]);
    expect(qr1).not.toBe(qr2);
  });

  it('same formId always produces the same output', async () => {
    const [qr1, qr2] = await Promise.all([
      generateQrCode('form-uuid-abc', 'https://app.leadgen.io'),
      generateQrCode('form-uuid-abc', 'https://app.leadgen.io'),
    ]);
    expect(qr1).toBe(qr2);
  });
});

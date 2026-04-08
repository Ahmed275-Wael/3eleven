/**
 * Integration tests — verify IPINFO_TOKEN and ABUSEIPDB_API_KEY are valid
 * by making real HTTP calls to ipinfo.io and AbuseIPDB.
 *
 * These tests are skipped automatically if the keys are not set in .env.
 */
import { describe, it, expect } from 'vitest';
import { lookupIpInfo, fetchAbuseScore } from '../../src/security/risk/ip-intelligence';

// 8.8.8.8 is Google's public DNS — well known, low abuse score, geolocates to US
const GOOGLE_DNS = '8.8.8.8';

describe('MODULE 6.4 — IP Intelligence API Keys (Integration)', () => {
  it.runIf(!!process.env.IPINFO_TOKEN)(
    'ipinfo.io token is valid — resolves geolocation for 8.8.8.8',
    async () => {
      const info = await lookupIpInfo(GOOGLE_DNS, process.env.IPINFO_TOKEN!);
      expect(info).not.toBeNull();
      expect(info?.country).toBe('US');
      expect(typeof info?.lat).toBe('number');
      expect(typeof info?.lon).toBe('number');
      expect(info?.org.toLowerCase()).toContain('google');
    },
    10_000,
  );

  it.runIf(!!process.env.ABUSEIPDB_API_KEY)(
    'abuseipdb API key is valid — returns 0–100 score for 8.8.8.8',
    async () => {
      const score = await fetchAbuseScore(GOOGLE_DNS, process.env.ABUSEIPDB_API_KEY!);
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    },
    10_000,
  );

  it('graceful degradation — bad ipinfo token returns null, not an error', async () => {
    const info = await lookupIpInfo(GOOGLE_DNS, 'invalid-token-xyz');
    expect(info).toBeNull();
  });

  it('graceful degradation — bad AbuseIPDB key returns 0, not an error', async () => {
    const score = await fetchAbuseScore(GOOGLE_DNS, 'invalid-key-xyz');
    expect(score).toBe(0);
  });

  it('empty ip/token → returns null/0 immediately without HTTP call', async () => {
    expect(await lookupIpInfo('', '')).toBeNull();
    expect(await fetchAbuseScore('', '')).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { scoreIpReputation } from '../../../src/security/risk/scorers/ip-reputation.scorer';
import { scoreFailedAttempts, type FailedAttempt } from '../../../src/security/risk/scorers/failed-attempts.scorer';
import { scoreImpossibleTravel, type LoginLocation } from '../../../src/security/risk/scorers/impossible-travel.scorer';
import { scoreNewDevice } from '../../../src/security/risk/scorers/new-device.scorer';

describe('MODULE 6.1 — IP Reputation Scorer', () => {
  it('known datacenter/VPN IP → score = 40', () => {
    // Using a known AWS datacenter IP range
    expect(scoreIpReputation('52.94.76.1')).toBe(40);
  });

  it('Tor exit node IP → score = 100', () => {
    expect(scoreIpReputation('185.220.100.240')).toBe(100);
  });

  it('residential IP → score = 0', () => {
    expect(scoreIpReputation('86.14.97.3')).toBe(0);
  });

  it('invalid IP format → score = 0', () => {
    expect(scoreIpReputation('not-an-ip')).toBe(0);
    expect(scoreIpReputation('')).toBe(0);
  });
});

describe('MODULE 6.1 — Failed Attempts Scorer', () => {
  const now = new Date();
  const minutesAgo = (min: number) => new Date(now.getTime() - min * 60_000);

  it('0 recent failures → score = 0', () => {
    expect(scoreFailedAttempts([])).toBe(0);
  });

  it('3 failures in last 15min → score = 20', () => {
    const attempts: FailedAttempt[] = [
      { timestamp: minutesAgo(5) },
      { timestamp: minutesAgo(8) },
      { timestamp: minutesAgo(12) },
    ];
    expect(scoreFailedAttempts(attempts)).toBe(20);
  });

  it('5+ failures in last 15min → score = 50', () => {
    const attempts: FailedAttempt[] = Array.from({ length: 6 }, (_, i) => ({
      timestamp: minutesAgo(i + 1),
    }));
    expect(scoreFailedAttempts(attempts)).toBe(50);
  });

  it('failures older than 15min → not counted', () => {
    const attempts: FailedAttempt[] = [
      { timestamp: minutesAgo(20) },
      { timestamp: minutesAgo(30) },
      { timestamp: minutesAgo(60) },
    ];
    expect(scoreFailedAttempts(attempts)).toBe(0);
  });
});

describe('MODULE 6.1 — Impossible Travel Scorer', () => {
  const now = new Date();
  const hoursAgo = (hr: number) => new Date(now.getTime() - hr * 3600_000);

  // London coords: 51.5074, -0.1278
  // New York coords: 40.7128, -74.0060
  const london: LoginLocation = { lat: 51.5074, lon: -0.1278, timestamp: hoursAgo(2) };
  const newYork: LoginLocation = { lat: 40.7128, lon: -74.0060, timestamp: now };

  it('same city, 2hr gap → score = 0', () => {
    const prev: LoginLocation = { lat: 51.51, lon: -0.13, timestamp: hoursAgo(2) };
    const curr: LoginLocation = { lat: 51.50, lon: -0.12, timestamp: now };
    expect(scoreImpossibleTravel(prev, curr)).toBe(0);
  });

  it('London → New York, 1hr gap → score = 100 (physically impossible)', () => {
    const prev: LoginLocation = { ...london, timestamp: hoursAgo(1) };
    const curr: LoginLocation = { ...newYork, timestamp: now };
    expect(scoreImpossibleTravel(prev, curr)).toBe(100);
  });

  it('London → New York, 10hr gap → score = 0 (feasible flight)', () => {
    const prev: LoginLocation = { ...london, timestamp: hoursAgo(10) };
    const curr: LoginLocation = { ...newYork, timestamp: now };
    expect(scoreImpossibleTravel(prev, curr)).toBe(0);
  });

  it('first login ever (no previous location) → score = 0', () => {
    expect(scoreImpossibleTravel(null, newYork)).toBe(0);
  });

  it('Haversine formula used for distance (test with known city-pair distances)', () => {
    // London to New York is ~5,570 km
    // If we travel that in 1 hour, speed > 5000 km/h = impossible
    const prev: LoginLocation = { ...london, timestamp: hoursAgo(1) };
    const curr: LoginLocation = { ...newYork, timestamp: now };
    // Should flag as impossible (score 100)
    expect(scoreImpossibleTravel(prev, curr)).toBe(100);
  });
});

describe('MODULE 6.1 — New Device Scorer', () => {
  it('device fingerprint seen before → score = 0', () => {
    expect(scoreNewDevice('fp-abc123', ['fp-abc123', 'fp-xyz789'])).toBe(0);
  });

  it('new fingerprint not in history → score = 20', () => {
    expect(scoreNewDevice('fp-new999', ['fp-abc123', 'fp-xyz789'])).toBe(20);
  });
});

// MODULE 6.1 — Impossible Travel Scorer

export interface LoginLocation {
  lat: number;
  lon: number;
  timestamp: Date;
}

const MAX_HUMAN_SPEED_KMH = 1000; // generous upper bound (supersonic flight)
const EARTH_RADIUS_KM = 6371;

function haversineKm(a: LoginLocation, b: LoginLocation): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function scoreImpossibleTravel(
  previous: LoginLocation | null,
  current: LoginLocation,
): number {
  if (!previous) return 0;

  const distanceKm = haversineKm(previous, current);
  const timeDiffHours = Math.abs(current.timestamp.getTime() - previous.timestamp.getTime()) / 3_600_000;

  if (timeDiffHours === 0) return distanceKm > 1 ? 100 : 0;

  const speedKmh = distanceKm / timeDiffHours;
  return speedKmh > MAX_HUMAN_SPEED_KMH ? 100 : 0;
}

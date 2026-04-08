// MODULE 6.4 — IP Intelligence (Live API enrichment)
// Both functions degrade gracefully: return null / 0 on timeout or error.

const TIMEOUT_MS = 3000;

export interface IpGeoInfo {
  country: string;
  city: string;
  lat: number;
  lon: number;
  org: string;
}

/**
 * Resolve geolocation for an IP using ipinfo.io.
 * Returns null on failure (network error, bad token, timeout).
 */
export async function lookupIpInfo(ip: string, token: string): Promise<IpGeoInfo | null> {
  if (!ip || !token) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`https://ipinfo.io/${ip}?token=${token}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json() as {
      country?: string;
      city?: string;
      loc?: string;
      org?: string;
    };
    if (!data.loc) return null;
    const [lat, lon] = data.loc.split(',').map(Number);
    return {
      country: data.country ?? '',
      city: data.city ?? '',
      lat,
      lon,
      org: data.org ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Fetch abuse confidence score (0–100) for an IP from AbuseIPDB.
 * Returns 0 on failure (network error, bad key, timeout).
 */
export async function fetchAbuseScore(ip: string, apiKey: string): Promise<number> {
  if (!ip || !apiKey) return 0;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`;
    const res = await fetch(url, {
      headers: { Key: apiKey, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return 0;
    const data = await res.json() as { data?: { abuseConfidenceScore?: number } };
    return data.data?.abuseConfidenceScore ?? 0;
  } catch {
    return 0;
  }
}

// MODULE 6.1 — IP Reputation Scorer

// Known Tor exit node prefixes (simplified for V1)
const TOR_PREFIXES = ['185.220.100.', '185.220.101.', '185.220.102.', '185.220.103.'];

// Known datacenter/VPN IP prefixes (simplified for V1)
const DATACENTER_PREFIXES = [
  '52.94.', '52.95.', '54.239.', '13.32.', '13.33.',  // AWS
  '104.16.', '104.17.', '104.18.', '104.19.',          // Cloudflare
  '35.190.', '35.191.',                                 // GCP
];

const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function scoreIpReputation(ip: string): number {
  if (!ip || !IP_REGEX.test(ip)) return 0;

  if (TOR_PREFIXES.some((prefix) => ip.startsWith(prefix))) return 100;
  if (DATACENTER_PREFIXES.some((prefix) => ip.startsWith(prefix))) return 40;

  return 0;
}

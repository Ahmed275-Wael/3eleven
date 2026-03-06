// MODULE 6.1 — New Device Scorer

export function scoreNewDevice(
  fingerprint: string,
  knownFingerprints: string[],
): number {
  return knownFingerprints.includes(fingerprint) ? 0 : 20;
}

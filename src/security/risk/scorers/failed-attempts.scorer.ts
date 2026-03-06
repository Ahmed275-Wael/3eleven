// MODULE 6.1 — Failed Attempts Scorer

export interface FailedAttempt {
  timestamp: Date;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function scoreFailedAttempts(attempts: FailedAttempt[]): number {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = attempts.filter((a) => a.timestamp.getTime() > cutoff);

  if (recent.length >= 5) return 50;
  if (recent.length >= 3) return 20;
  return 0;
}

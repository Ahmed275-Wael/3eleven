// MODULE 6.2 — Risk Aggregator

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskAction = 'ALLOW' | 'STEP_UP' | 'FORCE_REAUTH' | 'LOCK_ACCOUNT';

export interface RiskResult {
  level: RiskLevel;
  action: RiskAction;
}

function getThreshold(envKey: string, fallback: number): number {
  const val = process.env[envKey];
  return val ? Number(val) : fallback;
}

export function aggregate(scores: number[]): RiskResult {
  const total = scores.reduce((sum, s) => sum + s, 0);

  const mediumThreshold = getThreshold('RISK_MEDIUM_THRESHOLD', 30);
  const highThreshold = getThreshold('RISK_HIGH_THRESHOLD', 70);
  const criticalThreshold = getThreshold('RISK_CRITICAL_THRESHOLD', 150);

  if (total >= criticalThreshold) return { level: 'CRITICAL', action: 'LOCK_ACCOUNT' };
  if (total >= highThreshold) return { level: 'HIGH', action: 'FORCE_REAUTH' };
  if (total >= mediumThreshold) return { level: 'MEDIUM', action: 'STEP_UP' };
  return { level: 'LOW', action: 'ALLOW' };
}

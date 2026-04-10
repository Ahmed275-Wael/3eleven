// MODULE 9 — Lead Status Definitions
//
// V1: kept as a compile-time constant for zero-latency validation.
// V2: replace with a `lead_pipeline_stages` table + per-user custom stages.
//     Migration path: swap LEAD_STATUSES.includes(status) for
//     stagesRepo.isValidForUser(userId, status) — no schema change needed
//     because leads.status is already a plain varchar(30).

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'meeting_booked',
  'won',
  'lost',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

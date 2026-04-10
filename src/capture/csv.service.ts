// MODULE 10.4 — CSV Service

import { parse } from 'csv-parse/sync';
import type { LeadsService } from '../leads/leads.service.js';
import type { Lead } from '../leads/leads.repository.js';
import { DuplicateLeadError, BlacklistedLeadError } from '../leads/errors/index.js';

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const EXPORT_HEADERS = [
  'email',
  'firstName',
  'lastName',
  'phone',
  'company',
  'jobTitle',
  'status',
  'captureMethod',
  'capturedAt',
] as const;

type ExportHeader = (typeof EXPORT_HEADERS)[number];

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class CsvService {
  constructor(private readonly leadsService: LeadsService) {}

  async importLeads(
    userId: string,
    csvContent: string,
    columnMap: Record<string, string>,
    dedupMode: 'skip' | 'overwrite' | 'merge',
  ): Promise<ImportResult> {
    const rows = parse(csvContent, { columns: true, skip_empty_lines: true }) as Record<
      string,
      string
    >[];

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      // Map CSV columns to lead field names
      const data: Record<string, string> = {};
      for (const [field, col] of Object.entries(columnMap)) {
        const cell = row[col];
        if (cell !== undefined && cell !== '') data[field] = cell;
      }

      const email = data.email?.trim().toLowerCase();
      if (!email) {
        skipped++;
        continue;
      }

      try {
        await this.leadsService.captureLead({
          userId,
          ...data,
          email,
          captureMethod: 'import',
        });
        imported++;
      } catch (err) {
        if (err instanceof DuplicateLeadError) {
          if (dedupMode === 'skip') {
            skipped++;
          } else {
            // overwrite or merge: find existing lead and update it
            const existing = await this.leadsService.findLeadByEmail(userId, email);
            if (existing) {
              const updateData =
                dedupMode === 'merge'
                  ? Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== undefined && v !== null))
                  : data;
              await this.leadsService.updateLead(userId, existing.id, updateData);
              imported++;
            } else {
              skipped++;
            }
          }
        } else if (err instanceof BlacklistedLeadError) {
          skipped++;
        } else {
          failed++;
          errors.push((err as Error).message);
        }
      }
    }

    return { imported, skipped, failed, errors };
  }

  async exportLeads(leads: Lead[]): Promise<string> {
    const header = EXPORT_HEADERS.join(',');
    const dataRows = leads.map((lead) =>
      EXPORT_HEADERS.map((key) => escapeField((lead as Record<string, unknown>)[key])).join(','),
    );
    return [header, ...dataRows].join('\n');
  }
}

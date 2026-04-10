/**
 * MODULE 10.3 — CSV Service (Unit)
 *
 * Tests business logic in CsvService with the leads service mocked.
 * No database or containers required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsvService } from '../../../src/capture/csv.service.js';
import { DuplicateLeadError, BlacklistedLeadError } from '../../../src/leads/errors/index.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const MOCK_LEAD = {
  id: 'lead-1',
  userId: 'user-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  phone: '555-0100',
  company: 'Acme',
  jobTitle: 'CEO',
  captureMethod: 'import',
  captureSourceId: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  qualificationScore: null,
  qualificationAnswers: null,
  status: 'new',
  capturedAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function makeLeadsService() {
  return {
    captureLead: vi.fn().mockResolvedValue(MOCK_LEAD),
    getLead: vi.fn(),
    updateLead: vi.fn().mockResolvedValue(MOCK_LEAD),
    findLeadByEmail: vi.fn().mockResolvedValue(MOCK_LEAD),
    deleteLead: vi.fn(),
    updateStatus: vi.fn(),
    listLeads: vi.fn().mockResolvedValue({ leads: [MOCK_LEAD], total: 1 }),
    addTag: vi.fn(),
    removeTag: vi.fn(),
    addNote: vi.fn(),
    getLeadNotes: vi.fn(),
  };
}

// Simple CSV with header + 2 rows
const SAMPLE_CSV = `Email,First Name,Last Name,Company
alice@example.com,Alice,Smith,Acme
bob@example.com,Bob,Jones,Globex`;

const COLUMN_MAP = {
  email: 'Email',
  firstName: 'First Name',
  lastName: 'Last Name',
  company: 'Company',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MODULE 10.3 — CSV Service (Unit)', () => {
  let leadsService: ReturnType<typeof makeLeadsService>;
  let service: CsvService;

  beforeEach(() => {
    leadsService = makeLeadsService();
    service = new CsvService(leadsService as any);
  });

  // ── importLeads ───────────────────────────────────────────────────────────

  describe('importLeads', () => {
    it('imports all rows and returns correct counts', async () => {
      const result = await service.importLeads('user-1', SAMPLE_CSV, COLUMN_MAP, 'skip');
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('passes captureMethod=import and userId to leads service', async () => {
      await service.importLeads('user-1', SAMPLE_CSV, COLUMN_MAP, 'skip');
      expect(leadsService.captureLead).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          captureMethod: 'import',
          email: 'alice@example.com',
        }),
      );
    });

    it('normalises email to lowercase before import', async () => {
      const csv = `Email\nALICE@EXAMPLE.COM`;
      await service.importLeads('user-1', csv, { email: 'Email' }, 'skip');
      expect(leadsService.captureLead).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@example.com' }),
      );
    });

    it('skip mode: duplicate email increments skipped, does not throw', async () => {
      leadsService.captureLead
        .mockResolvedValueOnce(MOCK_LEAD)           // row 1 ok
        .mockRejectedValueOnce(new DuplicateLeadError()); // row 2 dup
      const result = await service.importLeads('user-1', SAMPLE_CSV, COLUMN_MAP, 'skip');
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('overwrite mode: duplicate calls updateLead instead', async () => {
      leadsService.captureLead
        .mockResolvedValueOnce(MOCK_LEAD)
        .mockRejectedValueOnce(new DuplicateLeadError());
      leadsService.updateLead.mockResolvedValue(MOCK_LEAD);

      const result = await service.importLeads('user-1', SAMPLE_CSV, COLUMN_MAP, 'overwrite');
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('blacklisted email counts as skipped in skip mode', async () => {
      leadsService.captureLead.mockRejectedValue(new BlacklistedLeadError());
      const result = await service.importLeads('user-1', SAMPLE_CSV, COLUMN_MAP, 'skip');
      expect(result.skipped).toBe(2);
      expect(result.imported).toBe(0);
    });

    it('unexpected error counts as failed', async () => {
      leadsService.captureLead
        .mockResolvedValueOnce(MOCK_LEAD)
        .mockRejectedValueOnce(new Error('DB is down'));
      const result = await service.importLeads('user-1', SAMPLE_CSV, COLUMN_MAP, 'skip');
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('skips rows where required email column is empty', async () => {
      const csv = `Email,First Name\n,Alice\nbob@example.com,Bob`;
      const result = await service.importLeads('user-1', csv, { email: 'Email', firstName: 'First Name' }, 'skip');
      expect(leadsService.captureLead).toHaveBeenCalledTimes(1);
      expect(result.skipped).toBe(1);
    });
  });

  // ── exportLeads ───────────────────────────────────────────────────────────

  describe('exportLeads', () => {
    it('returns a CSV string with a header row', async () => {
      const result = await service.exportLeads([MOCK_LEAD]);
      const lines = result.trim().split('\n');
      expect(lines[0]).toMatch(/email/i);
    });

    it('includes lead data in subsequent rows', async () => {
      const result = await service.exportLeads([MOCK_LEAD]);
      expect(result).toContain('alice@example.com');
      expect(result).toContain('Alice');
      expect(result).toContain('Acme');
    });

    it('returns header-only CSV for empty array', async () => {
      const result = await service.exportLeads([]);
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/email/i);
    });

    it('produces one data row per lead', async () => {
      const lead2 = { ...MOCK_LEAD, id: 'lead-2', email: 'bob@example.com' };
      const result = await service.exportLeads([MOCK_LEAD, lead2]);
      const lines = result.trim().split('\n');
      expect(lines).toHaveLength(3); // header + 2 rows
    });
  });
});

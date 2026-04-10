/**
 * MODULE 9.1 — Leads Service (Unit)
 *
 * Tests business logic in LeadsService with all repositories mocked.
 * No database or containers required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeadsService, type CaptureLeadInput } from '../../../src/leads/leads.service.js';
import {
  DuplicateLeadError,
  BlacklistedLeadError,
  LeadNotFoundError,
  InvalidLeadStatusError,
} from '../../../src/leads/errors/index.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const MOCK_LEAD = {
  id: 'lead-uuid-1',
  userId: 'user-uuid-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  phone: null,
  company: 'Acme',
  jobTitle: null,
  captureMethod: 'manual' as const,
  captureSourceId: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  qualificationScore: null,
  qualificationAnswers: null,
  status: 'new',
  capturedAt: new Date(),
  updatedAt: new Date(),
};

function makeLeadsRepo() {
  return {
    createLead: vi.fn().mockResolvedValue(MOCK_LEAD),
    findById: vi.fn().mockResolvedValue(MOCK_LEAD),
    findByEmail: vi.fn().mockResolvedValue(null),
    updateLead: vi.fn().mockResolvedValue({ ...MOCK_LEAD }),
    deleteLead: vi.fn().mockResolvedValue(true),
    listLeads: vi.fn().mockResolvedValue([MOCK_LEAD]),
    countLeads: vi.fn().mockResolvedValue(1),
  };
}

function makeBlacklistRepo() {
  return {
    add: vi.fn(),
    remove: vi.fn(),
    isBlacklisted: vi.fn().mockResolvedValue(false),
    listByUser: vi.fn().mockResolvedValue([]),
  };
}

function makeTagsRepo() {
  return {
    addTag: vi.fn().mockResolvedValue(undefined),
    removeTag: vi.fn().mockResolvedValue(undefined),
    getLeadTags: vi.fn().mockResolvedValue([]),
    searchByTag: vi.fn().mockResolvedValue([]),
    deleteLeadTags: vi.fn().mockResolvedValue(undefined),
  };
}

function makeNotesRepo() {
  return {
    createNote: vi.fn().mockResolvedValue({ id: 'note-1', leadId: 'lead-uuid-1', body: 'Note body', createdAt: new Date(), createdBy: 'user-uuid-1' }),
    getLeadNotes: vi.fn().mockResolvedValue([]),
    deleteNote: vi.fn().mockResolvedValue(true),
  };
}

function makeListsRepo() {
  return {
    createList: vi.fn(),
    findById: vi.fn(),
    updateList: vi.fn(),
    deleteList: vi.fn(),
    listsByUser: vi.fn().mockResolvedValue([]),
    addMembers: vi.fn().mockResolvedValue(undefined),
    removeMembers: vi.fn().mockResolvedValue(undefined),
    getListLeads: vi.fn().mockResolvedValue([]),
    getMemberCount: vi.fn().mockResolvedValue(0),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MODULE 9.1 — Leads Service (Unit)', () => {
  let service: LeadsService;
  let leadsRepo: ReturnType<typeof makeLeadsRepo>;
  let blacklistRepo: ReturnType<typeof makeBlacklistRepo>;
  let tagsRepo: ReturnType<typeof makeTagsRepo>;
  let notesRepo: ReturnType<typeof makeNotesRepo>;
  let listsRepo: ReturnType<typeof makeListsRepo>;

  const BASE_INPUT: CaptureLeadInput = {
    userId: 'user-uuid-1',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    company: 'Acme',
    captureMethod: 'manual',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    leadsRepo = makeLeadsRepo();
    blacklistRepo = makeBlacklistRepo();
    tagsRepo = makeTagsRepo();
    notesRepo = makeNotesRepo();
    listsRepo = makeListsRepo();
    service = new LeadsService(
      leadsRepo as any,
      blacklistRepo as any,
      tagsRepo as any,
      notesRepo as any,
      listsRepo as any,
    );
  });

  // ── captureLead ──────────────────────────────────────────────────────────

  describe('captureLead()', () => {
    it('checks blacklist for email before creating', async () => {
      await service.captureLead(BASE_INPUT);
      expect(blacklistRepo.isBlacklisted).toHaveBeenCalledWith(
        BASE_INPUT.userId,
        BASE_INPUT.email,
      );
    });

    it('blacklisted email → throws BlacklistedLeadError (never calls createLead)', async () => {
      blacklistRepo.isBlacklisted.mockResolvedValue(true);
      await expect(service.captureLead(BASE_INPUT)).rejects.toThrow(BlacklistedLeadError);
      expect(leadsRepo.createLead).not.toHaveBeenCalled();
    });

    it('duplicate email for same user → throws DuplicateLeadError', async () => {
      leadsRepo.findByEmail.mockResolvedValue(MOCK_LEAD);
      await expect(service.captureLead(BASE_INPUT)).rejects.toThrow(DuplicateLeadError);
      expect(leadsRepo.createLead).not.toHaveBeenCalled();
    });

    it('normalises email to lowercase before all checks', async () => {
      await service.captureLead({ ...BASE_INPUT, email: 'ALICE@EXAMPLE.COM' });
      expect(blacklistRepo.isBlacklisted).toHaveBeenCalledWith(
        BASE_INPUT.userId,
        'alice@example.com',
      );
      expect(leadsRepo.findByEmail).toHaveBeenCalledWith(
        BASE_INPUT.userId,
        'alice@example.com',
      );
    });

    it('passes through UTM parameters to createLead', async () => {
      await service.captureLead({
        ...BASE_INPUT,
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'spring-sale',
      });
      expect(leadsRepo.createLead).toHaveBeenCalledWith(
        expect.objectContaining({
          utmSource: 'google',
          utmMedium: 'cpc',
          utmCampaign: 'spring-sale',
        }),
      );
    });

    it('returns the created lead on success', async () => {
      const result = await service.captureLead(BASE_INPUT);
      expect(result).toEqual(MOCK_LEAD);
    });

    it('captureMethod defaults to manual when not provided', async () => {
      const { captureMethod, ...withoutMethod } = BASE_INPUT;
      await service.captureLead(withoutMethod as CaptureLeadInput);
      expect(leadsRepo.createLead).toHaveBeenCalledWith(
        expect.objectContaining({ captureMethod: 'manual' }),
      );
    });
  });

  // ── getLead ───────────────────────────────────────────────────────────────

  describe('getLead()', () => {
    it('returns lead when found', async () => {
      const lead = await service.getLead('user-uuid-1', 'lead-uuid-1');
      expect(leadsRepo.findById).toHaveBeenCalledWith('user-uuid-1', 'lead-uuid-1');
      expect(lead).toEqual(MOCK_LEAD);
    });

    it('throws LeadNotFoundError when lead does not exist', async () => {
      leadsRepo.findById.mockResolvedValue(null);
      await expect(service.getLead('user-uuid-1', 'nonexistent')).rejects.toThrow(
        LeadNotFoundError,
      );
    });

    it('scopes lookup to userId (no cross-tenant access)', async () => {
      await service.getLead('user-uuid-1', 'lead-uuid-1');
      const [calledUserId] = leadsRepo.findById.mock.calls[0];
      expect(calledUserId).toBe('user-uuid-1');
    });
  });

  // ── updateLead ────────────────────────────────────────────────────────────

  describe('updateLead()', () => {
    it('calls updateLead on repo with correct userId and data', async () => {
      await service.updateLead('user-uuid-1', 'lead-uuid-1', { company: 'NewCo' });
      expect(leadsRepo.updateLead).toHaveBeenCalledWith(
        'user-uuid-1',
        'lead-uuid-1',
        expect.objectContaining({ company: 'NewCo' }),
      );
    });

    it('repo returns null → throws LeadNotFoundError', async () => {
      leadsRepo.updateLead.mockResolvedValue(null);
      await expect(
        service.updateLead('user-uuid-1', 'lead-uuid-1', { company: 'X' }),
      ).rejects.toThrow(LeadNotFoundError);
    });

    it('returns updated lead on success', async () => {
      const updated = { ...MOCK_LEAD, company: 'NewCo' };
      leadsRepo.updateLead.mockResolvedValue(updated);
      const result = await service.updateLead('user-uuid-1', 'lead-uuid-1', { company: 'NewCo' });
      expect(result.company).toBe('NewCo');
    });
  });

  // ── deleteLead ────────────────────────────────────────────────────────────

  describe('deleteLead()', () => {
    it('calls deleteLead on repo', async () => {
      await service.deleteLead('user-uuid-1', 'lead-uuid-1');
      expect(leadsRepo.deleteLead).toHaveBeenCalledWith('user-uuid-1', 'lead-uuid-1');
    });

    it('repo returns false → throws LeadNotFoundError', async () => {
      leadsRepo.deleteLead.mockResolvedValue(false);
      await expect(service.deleteLead('user-uuid-1', 'lead-uuid-1')).rejects.toThrow(
        LeadNotFoundError,
      );
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus()', () => {
    const VALID_STATUSES = ['new', 'contacted', 'qualified', 'meeting_booked', 'won', 'lost'];

    it.each(VALID_STATUSES)('status "%s" → accepted and passed to updateLead', async (status) => {
      await service.updateStatus('user-uuid-1', 'lead-uuid-1', status);
      expect(leadsRepo.updateLead).toHaveBeenCalledWith(
        'user-uuid-1',
        'lead-uuid-1',
        expect.objectContaining({ status }),
      );
    });

    it('invalid status → throws InvalidLeadStatusError', async () => {
      await expect(
        service.updateStatus('user-uuid-1', 'lead-uuid-1', 'invalid_stage'),
      ).rejects.toThrow(InvalidLeadStatusError);
      expect(leadsRepo.updateLead).not.toHaveBeenCalled();
    });
  });

  // ── listLeads ─────────────────────────────────────────────────────────────

  describe('listLeads()', () => {
    it('returns { leads, total } from repo', async () => {
      leadsRepo.listLeads.mockResolvedValue([MOCK_LEAD]);
      leadsRepo.countLeads.mockResolvedValue(1);
      const result = await service.listLeads('user-uuid-1');
      expect(result).toEqual({ leads: [MOCK_LEAD], total: 1 });
    });

    it('passes filters and pagination through to repo', async () => {
      const filters = { status: 'new', captureMethod: 'manual' };
      const pagination = { limit: 10, offset: 20 };
      await service.listLeads('user-uuid-1', filters, pagination);
      expect(leadsRepo.listLeads).toHaveBeenCalledWith('user-uuid-1', filters, pagination);
      expect(leadsRepo.countLeads).toHaveBeenCalledWith('user-uuid-1', filters);
    });
  });

  // ── addTag ────────────────────────────────────────────────────────────────

  describe('addTag()', () => {
    it('verifies lead ownership then calls tagsRepo.addTag', async () => {
      await service.addTag('user-uuid-1', 'lead-uuid-1', 'hot');
      expect(leadsRepo.findById).toHaveBeenCalledWith('user-uuid-1', 'lead-uuid-1');
      expect(tagsRepo.addTag).toHaveBeenCalledWith('lead-uuid-1', 'hot');
    });

    it('lead not found → throws LeadNotFoundError before calling tagsRepo', async () => {
      leadsRepo.findById.mockResolvedValue(null);
      await expect(service.addTag('user-uuid-1', 'lead-uuid-1', 'hot')).rejects.toThrow(
        LeadNotFoundError,
      );
      expect(tagsRepo.addTag).not.toHaveBeenCalled();
    });
  });

  // ── removeTag ─────────────────────────────────────────────────────────────

  describe('removeTag()', () => {
    it('verifies lead ownership then calls tagsRepo.removeTag', async () => {
      await service.removeTag('user-uuid-1', 'lead-uuid-1', 'hot');
      expect(leadsRepo.findById).toHaveBeenCalledWith('user-uuid-1', 'lead-uuid-1');
      expect(tagsRepo.removeTag).toHaveBeenCalledWith('lead-uuid-1', 'hot');
    });
  });

  // ── addNote ───────────────────────────────────────────────────────────────

  describe('addNote()', () => {
    it('verifies lead ownership then calls notesRepo.createNote', async () => {
      await service.addNote('user-uuid-1', 'lead-uuid-1', 'Called today');
      expect(leadsRepo.findById).toHaveBeenCalledWith('user-uuid-1', 'lead-uuid-1');
      expect(notesRepo.createNote).toHaveBeenCalledWith('lead-uuid-1', 'Called today', 'user-uuid-1');
    });

    it('lead not found → throws LeadNotFoundError', async () => {
      leadsRepo.findById.mockResolvedValue(null);
      await expect(
        service.addNote('user-uuid-1', 'lead-uuid-1', 'body'),
      ).rejects.toThrow(LeadNotFoundError);
      expect(notesRepo.createNote).not.toHaveBeenCalled();
    });

    it('returns the created note', async () => {
      const note = await service.addNote('user-uuid-1', 'lead-uuid-1', 'Called today');
      expect(note).toBeDefined();
      expect(note.body).toBe('Note body');
    });
  });

  // ── getLeadNotes ──────────────────────────────────────────────────────────

  describe('getLeadNotes()', () => {
    it('verifies lead ownership then returns notes', async () => {
      const mockNotes = [{ id: 'n1', leadId: 'lead-uuid-1', body: 'Note', createdAt: new Date(), createdBy: null }];
      notesRepo.getLeadNotes.mockResolvedValue(mockNotes);
      const notes = await service.getLeadNotes('user-uuid-1', 'lead-uuid-1');
      expect(leadsRepo.findById).toHaveBeenCalledWith('user-uuid-1', 'lead-uuid-1');
      expect(notes).toEqual(mockNotes);
    });
  });
});

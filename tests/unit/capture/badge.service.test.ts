/**
 * MODULE 10.2 — Badge Service (Unit)
 *
 * Tests business logic in BadgeService with all dependencies mocked.
 * No database or containers required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadgeService } from '../../../src/capture/badge.service.js';
import {
  EventNotFoundError,
  AttendeeNotFoundError,
  AlreadyScannedError,
} from '../../../src/capture/errors/index.js';
import { BlacklistedLeadError } from '../../../src/leads/errors/index.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const MOCK_EVENT = {
  id: 'event-uuid-1',
  userId: 'user-uuid-1',
  name: 'SXSW 2026',
  eventDate: '2026-03-15',
  qualificationFormId: null,
  createdAt: new Date(),
};

const MOCK_ATTENDEE = {
  id: 'attendee-uuid-1',
  eventId: 'event-uuid-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  company: 'Acme',
  jobTitle: 'CEO',
  badgePdfPath: null,
  scannedAt: null,
  leadId: null,
  createdAt: new Date(),
};

const MOCK_LEAD = {
  id: 'lead-uuid-1',
  userId: 'user-uuid-1',
  email: 'alice@example.com',
  captureMethod: 'badge_scan',
  status: 'new',
  capturedAt: new Date(),
  updatedAt: new Date(),
};

function makeBadgeEventsRepo() {
  return {
    createEvent: vi.fn().mockResolvedValue(MOCK_EVENT),
    findEventById: vi.fn().mockResolvedValue(MOCK_EVENT),
    listEventsByUser: vi.fn().mockResolvedValue([MOCK_EVENT]),
    addAttendees: vi.fn().mockResolvedValue(1),
    getAttendees: vi.fn().mockResolvedValue([MOCK_ATTENDEE]),
    findAttendeeById: vi.fn().mockResolvedValue(MOCK_ATTENDEE),
    scanAttendee: vi.fn().mockResolvedValue(undefined),
    deleteEvent: vi.fn().mockResolvedValue(true),
  };
}

function makeLeadsService() {
  return {
    captureLead: vi.fn().mockResolvedValue(MOCK_LEAD),
    getLead: vi.fn(),
    updateLead: vi.fn(),
    deleteLead: vi.fn(),
    updateStatus: vi.fn(),
    listLeads: vi.fn(),
    addTag: vi.fn(),
    removeTag: vi.fn(),
    addNote: vi.fn(),
    getLeadNotes: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MODULE 10.2 — Badge Service (Unit)', () => {
  let badgeRepo: ReturnType<typeof makeBadgeEventsRepo>;
  let leadsService: ReturnType<typeof makeLeadsService>;
  let service: BadgeService;

  beforeEach(() => {
    badgeRepo = makeBadgeEventsRepo();
    leadsService = makeLeadsService();
    service = new BadgeService(badgeRepo, leadsService as any);
  });

  // ── createEvent ───────────────────────────────────────────────────────────

  describe('createEvent', () => {
    it('creates event with name and optional date', async () => {
      const event = await service.createEvent('user-uuid-1', 'SXSW 2026', '2026-03-15');
      expect(badgeRepo.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-uuid-1', name: 'SXSW 2026', eventDate: '2026-03-15' }),
      );
      expect(event.name).toBe('SXSW 2026');
    });

    it('creates event without date', async () => {
      await service.createEvent('user-uuid-1', 'General Event');
      expect(badgeRepo.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventDate: undefined }),
      );
    });
  });

  // ── getEvent ──────────────────────────────────────────────────────────────

  describe('getEvent', () => {
    it('returns event when found', async () => {
      const event = await service.getEvent('user-uuid-1', 'event-uuid-1');
      expect(event.id).toBe('event-uuid-1');
    });

    it('throws EventNotFoundError when repo returns null', async () => {
      badgeRepo.findEventById.mockResolvedValue(null);
      await expect(service.getEvent('user-uuid-1', 'missing')).rejects.toThrow(EventNotFoundError);
    });
  });

  // ── listEvents ────────────────────────────────────────────────────────────

  describe('listEvents', () => {
    it('returns all events for the user', async () => {
      const events = await service.listEvents('user-uuid-1');
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('SXSW 2026');
    });
  });

  // ── uploadAttendees ───────────────────────────────────────────────────────

  describe('uploadAttendees', () => {
    it('inserts attendees and returns count', async () => {
      badgeRepo.addAttendees.mockResolvedValue(3);
      const result = await service.uploadAttendees('user-uuid-1', 'event-uuid-1', [
        { email: 'a@b.com', firstName: 'A', lastName: 'B' },
        { email: 'c@d.com', firstName: 'C', lastName: 'D' },
        { email: 'e@f.com', firstName: 'E', lastName: 'F' },
      ]);
      expect(result.inserted).toBe(3);
    });

    it('throws EventNotFoundError when event not found', async () => {
      badgeRepo.findEventById.mockResolvedValue(null);
      await expect(
        service.uploadAttendees('user-uuid-1', 'missing', []),
      ).rejects.toThrow(EventNotFoundError);
    });
  });

  // ── scanBadge ─────────────────────────────────────────────────────────────

  describe('scanBadge', () => {
    it('creates a lead with captureMethod badge_scan', async () => {
      const result = await service.scanBadge('user-uuid-1', 'event-uuid-1', 'attendee-uuid-1');
      expect(leadsService.captureLead).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          email: 'alice@example.com',
          captureMethod: 'badge_scan',
        }),
      );
      expect(result.lead.id).toBe('lead-uuid-1');
    });

    it('sets scannedAt and leadId on the attendee after creating lead', async () => {
      await service.scanBadge('user-uuid-1', 'event-uuid-1', 'attendee-uuid-1');
      expect(badgeRepo.scanAttendee).toHaveBeenCalledWith('attendee-uuid-1', 'lead-uuid-1');
    });

    it('throws AlreadyScannedError when badge already scanned', async () => {
      badgeRepo.findAttendeeById.mockResolvedValue({
        ...MOCK_ATTENDEE,
        scannedAt: new Date(),
        leadId: 'existing-lead-id',
      });
      await expect(service.scanBadge('user-uuid-1', 'event-uuid-1', 'attendee-uuid-1'))
        .rejects.toThrow(AlreadyScannedError);
    });

    it('throws AttendeeNotFoundError when attendee not found', async () => {
      badgeRepo.findAttendeeById.mockResolvedValue(null);
      await expect(service.scanBadge('user-uuid-1', 'event-uuid-1', 'missing'))
        .rejects.toThrow(AttendeeNotFoundError);
    });

    it('propagates BlacklistedLeadError from leads service', async () => {
      leadsService.captureLead.mockRejectedValue(new BlacklistedLeadError());
      await expect(service.scanBadge('user-uuid-1', 'event-uuid-1', 'attendee-uuid-1'))
        .rejects.toThrow(BlacklistedLeadError);
    });

    it('throws EventNotFoundError when event not found', async () => {
      badgeRepo.findEventById.mockResolvedValue(null);
      await expect(service.scanBadge('user-uuid-1', 'event-uuid-1', 'attendee-uuid-1'))
        .rejects.toThrow(EventNotFoundError);
    });
  });

  // ── deleteEvent ───────────────────────────────────────────────────────────

  describe('deleteEvent', () => {
    it('deletes event and returns void', async () => {
      await expect(service.deleteEvent('user-uuid-1', 'event-uuid-1')).resolves.toBeUndefined();
      expect(badgeRepo.deleteEvent).toHaveBeenCalledWith('user-uuid-1', 'event-uuid-1');
    });

    it('throws EventNotFoundError when event not found', async () => {
      badgeRepo.deleteEvent.mockResolvedValue(false);
      await expect(service.deleteEvent('user-uuid-1', 'missing'))
        .rejects.toThrow(EventNotFoundError);
    });
  });
});

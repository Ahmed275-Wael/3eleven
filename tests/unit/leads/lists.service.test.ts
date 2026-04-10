/**
 * MODULE 11.1 — Lists Service (Unit)
 *
 * Tests business logic in ListsService with all repositories mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListsService } from '../../../src/leads/lists.service.js';
import { ListNotFoundError, LeadNotFoundError } from '../../../src/leads/errors/index.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const MOCK_LIST = {
  id: 'list-uuid-1',
  userId: 'user-uuid-1',
  name: 'SXSW 2026',
  createdAt: new Date(),
};

const MOCK_LEAD = {
  id: 'lead-uuid-1',
  userId: 'user-uuid-1',
  email: 'alice@example.com',
};

function makeListsRepo() {
  return {
    createList: vi.fn().mockResolvedValue(MOCK_LIST),
    findById: vi.fn().mockResolvedValue(MOCK_LIST),
    updateList: vi.fn().mockResolvedValue({ ...MOCK_LIST, name: 'Updated' }),
    deleteList: vi.fn().mockResolvedValue(true),
    listsByUser: vi.fn().mockResolvedValue([MOCK_LIST]),
    addMembers: vi.fn().mockResolvedValue(undefined),
    removeMembers: vi.fn().mockResolvedValue(undefined),
    getListLeads: vi.fn().mockResolvedValue([MOCK_LEAD]),
    getMemberCount: vi.fn().mockResolvedValue(3),
  };
}

function makeLeadsRepo() {
  return {
    findById: vi.fn().mockResolvedValue(MOCK_LEAD),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MODULE 11.1 — Lists Service (Unit)', () => {
  let service: ListsService;
  let listsRepo: ReturnType<typeof makeListsRepo>;
  let leadsRepo: ReturnType<typeof makeLeadsRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    listsRepo = makeListsRepo();
    leadsRepo = makeLeadsRepo();
    service = new ListsService(listsRepo as any, leadsRepo as any);
  });

  // ── createList ────────────────────────────────────────────────────────────

  describe('createList()', () => {
    it('calls repo.createList with userId and name', async () => {
      await service.createList('user-uuid-1', 'SXSW 2026');
      expect(listsRepo.createList).toHaveBeenCalledWith('user-uuid-1', 'SXSW 2026');
    });

    it('returns the created list', async () => {
      const result = await service.createList('user-uuid-1', 'SXSW 2026');
      expect(result).toEqual(MOCK_LIST);
    });

    it('empty name → throws ValidationError', async () => {
      const { ValidationError } = await import('../../../src/leads/errors/index.js');
      await expect(service.createList('user-uuid-1', '')).rejects.toThrow(ValidationError);
      expect(listsRepo.createList).not.toHaveBeenCalled();
    });

    it('name trimmed before saving', async () => {
      await service.createList('user-uuid-1', '  My List  ');
      expect(listsRepo.createList).toHaveBeenCalledWith('user-uuid-1', 'My List');
    });
  });

  // ── getList ───────────────────────────────────────────────────────────────

  describe('getList()', () => {
    it('returns list when found', async () => {
      const result = await service.getList('user-uuid-1', 'list-uuid-1');
      expect(result).toEqual(MOCK_LIST);
    });

    it('list not found → throws ListNotFoundError', async () => {
      listsRepo.findById.mockResolvedValue(null);
      await expect(service.getList('user-uuid-1', 'list-uuid-1')).rejects.toThrow(
        ListNotFoundError,
      );
    });

    it('list belongs to another user → throws ListNotFoundError', async () => {
      listsRepo.findById.mockResolvedValue({ ...MOCK_LIST, userId: 'other-user' });
      await expect(service.getList('user-uuid-1', 'list-uuid-1')).rejects.toThrow(
        ListNotFoundError,
      );
    });
  });

  // ── renameList ────────────────────────────────────────────────────────────

  describe('renameList()', () => {
    it('calls repo.updateList with new name', async () => {
      await service.renameList('user-uuid-1', 'list-uuid-1', 'New Name');
      expect(listsRepo.updateList).toHaveBeenCalledWith(
        'user-uuid-1',
        'list-uuid-1',
        { name: 'New Name' },
      );
    });

    it('list not found → throws ListNotFoundError', async () => {
      listsRepo.findById.mockResolvedValue(null);
      await expect(
        service.renameList('user-uuid-1', 'list-uuid-1', 'Name'),
      ).rejects.toThrow(ListNotFoundError);
    });
  });

  // ── deleteList ────────────────────────────────────────────────────────────

  describe('deleteList()', () => {
    it('calls repo.deleteList with userId and listId', async () => {
      await service.deleteList('user-uuid-1', 'list-uuid-1');
      expect(listsRepo.deleteList).toHaveBeenCalledWith('user-uuid-1', 'list-uuid-1');
    });

    it('list not found → throws ListNotFoundError', async () => {
      listsRepo.findById.mockResolvedValue(null);
      await expect(service.deleteList('user-uuid-1', 'list-uuid-1')).rejects.toThrow(
        ListNotFoundError,
      );
    });
  });

  // ── addLeadsToList ────────────────────────────────────────────────────────

  describe('addLeadsToList()', () => {
    it('calls repo.addMembers with listId and leadIds', async () => {
      await service.addLeadsToList('user-uuid-1', 'list-uuid-1', ['lead-uuid-1']);
      expect(listsRepo.addMembers).toHaveBeenCalledWith('list-uuid-1', ['lead-uuid-1']);
    });

    it('list not found → throws ListNotFoundError', async () => {
      listsRepo.findById.mockResolvedValue(null);
      await expect(
        service.addLeadsToList('user-uuid-1', 'list-uuid-1', ['lead-uuid-1']),
      ).rejects.toThrow(ListNotFoundError);
    });
  });

  // ── removeLeadsFromList ───────────────────────────────────────────────────

  describe('removeLeadsFromList()', () => {
    it('calls repo.removeMembers with listId and leadIds', async () => {
      await service.removeLeadsFromList('user-uuid-1', 'list-uuid-1', ['lead-uuid-1']);
      expect(listsRepo.removeMembers).toHaveBeenCalledWith('list-uuid-1', ['lead-uuid-1']);
    });
  });

  // ── getListLeads ──────────────────────────────────────────────────────────

  describe('getListLeads()', () => {
    it('verifies list ownership then returns leads', async () => {
      const result = await service.getListLeads('user-uuid-1', 'list-uuid-1');
      expect(listsRepo.findById).toHaveBeenCalledWith('user-uuid-1', 'list-uuid-1');
      expect(listsRepo.getListLeads).toHaveBeenCalled();
      expect(result).toEqual([MOCK_LEAD]);
    });

    it('list not found → throws ListNotFoundError', async () => {
      listsRepo.findById.mockResolvedValue(null);
      await expect(service.getListLeads('user-uuid-1', 'list-uuid-1')).rejects.toThrow(
        ListNotFoundError,
      );
    });
  });

  // ── getUserLists ──────────────────────────────────────────────────────────

  describe('getUserLists()', () => {
    it('returns all lists for user', async () => {
      const result = await service.getUserLists('user-uuid-1');
      expect(listsRepo.listsByUser).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual([MOCK_LIST]);
    });
  });
});

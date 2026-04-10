/**
 * MODULE 11.2 — Blacklist Service (Unit)
 *
 * Tests business logic in BlacklistService with repositories mocked.
 * Focus: domain extraction, duplicate prevention, email/domain matching logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlacklistService } from '../../../src/leads/blacklist.service.js';
import { DuplicateBlacklistError } from '../../../src/leads/errors/index.js';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

const MOCK_ENTRY = {
  id: 'bl-uuid-1',
  userId: 'user-uuid-1',
  value: 'spam@example.com',
  type: 'email' as const,
  createdAt: new Date(),
};

function makeBlacklistRepo() {
  return {
    add: vi.fn().mockResolvedValue(MOCK_ENTRY),
    remove: vi.fn().mockResolvedValue(true),
    isBlacklisted: vi.fn().mockResolvedValue(false),
    listByUser: vi.fn().mockResolvedValue([MOCK_ENTRY]),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MODULE 11.2 — Blacklist Service (Unit)', () => {
  let service: BlacklistService;
  let repo: ReturnType<typeof makeBlacklistRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = makeBlacklistRepo();
    service = new BlacklistService(repo as any);
  });

  // ── addEmail ──────────────────────────────────────────────────────────────

  describe('addEmail()', () => {
    it('calls repo.add with userId, email, and type="email"', async () => {
      await service.addEmail('user-uuid-1', 'spam@example.com');
      expect(repo.add).toHaveBeenCalledWith('user-uuid-1', 'spam@example.com', 'email');
    });

    it('normalises email to lowercase before adding', async () => {
      await service.addEmail('user-uuid-1', 'SPAM@EXAMPLE.COM');
      expect(repo.add).toHaveBeenCalledWith('user-uuid-1', 'spam@example.com', 'email');
    });

    it('duplicate (userId, email) → throws DuplicateBlacklistError', async () => {
      repo.add.mockRejectedValue(Object.assign(new Error('unique'), { code: '23505' }));
      await expect(service.addEmail('user-uuid-1', 'spam@example.com')).rejects.toThrow(
        DuplicateBlacklistError,
      );
    });
  });

  // ── addDomain ─────────────────────────────────────────────────────────────

  describe('addDomain()', () => {
    it('calls repo.add with userId, domain, and type="domain"', async () => {
      await service.addDomain('user-uuid-1', 'spammy.com');
      expect(repo.add).toHaveBeenCalledWith('user-uuid-1', 'spammy.com', 'domain');
    });

    it('normalises domain to lowercase', async () => {
      await service.addDomain('user-uuid-1', 'SPAMMY.COM');
      expect(repo.add).toHaveBeenCalledWith('user-uuid-1', 'spammy.com', 'domain');
    });

    it('duplicate domain → throws DuplicateBlacklistError', async () => {
      repo.add.mockRejectedValue(Object.assign(new Error('unique'), { code: '23505' }));
      await expect(service.addDomain('user-uuid-1', 'spammy.com')).rejects.toThrow(
        DuplicateBlacklistError,
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('calls repo.remove with userId and normalised value', async () => {
      await service.remove('user-uuid-1', 'spam@example.com');
      expect(repo.remove).toHaveBeenCalledWith('user-uuid-1', 'spam@example.com');
    });

    it('returns true when entry existed and was removed', async () => {
      const result = await service.remove('user-uuid-1', 'spam@example.com');
      expect(result).toBe(true);
    });

    it('returns false when entry did not exist', async () => {
      repo.remove.mockResolvedValue(false);
      const result = await service.remove('user-uuid-1', 'unknown@example.com');
      expect(result).toBe(false);
    });
  });

  // ── isBlacklisted ─────────────────────────────────────────────────────────

  describe('isBlacklisted()', () => {
    it('returns false when email and domain are not blacklisted', async () => {
      repo.isBlacklisted.mockResolvedValue(false);
      const result = await service.isBlacklisted('user-uuid-1', 'clean@example.com');
      expect(result).toBe(false);
    });

    it('returns true when the exact email is blacklisted', async () => {
      repo.isBlacklisted.mockResolvedValue(true);
      const result = await service.isBlacklisted('user-uuid-1', 'spam@example.com');
      expect(result).toBe(true);
    });

    it('normalises email to lowercase before checking', async () => {
      await service.isBlacklisted('user-uuid-1', 'SPAM@EXAMPLE.COM');
      expect(repo.isBlacklisted).toHaveBeenCalledWith('user-uuid-1', 'spam@example.com');
    });
  });

  // ── listEntries ───────────────────────────────────────────────────────────

  describe('listEntries()', () => {
    it('returns all blacklist entries for a user', async () => {
      const result = await service.listEntries('user-uuid-1');
      expect(repo.listByUser).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual([MOCK_ENTRY]);
    });
  });
});

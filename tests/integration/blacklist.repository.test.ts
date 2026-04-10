/**
 * MODULE 14.1 — Blacklist Repository (Integration)
 *
 * Uses a real PostgreSQL container. Tests blacklist storage and lookup logic.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupLeadsTestDb, type LeadsTestDb } from '../helpers/test-db-leads.js';
import { BlacklistRepository } from '../../src/leads/blacklist.repository.js';

describe('MODULE 14.1 — Blacklist Repository (Integration)', () => {
  let testDb: LeadsTestDb;
  let repo: BlacklistRepository;
  let userId: string;

  beforeAll(async () => {
    testDb = await setupLeadsTestDb();
    repo = new BlacklistRepository(testDb.db);
  }, 60_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.client.unsafe('DELETE FROM lead_blacklist');
    await testDb.client.unsafe('DELETE FROM users');
    userId = await testDb.createUser();
  });

  // ── add ───────────────────────────────────────────────────────────────────

  describe('add()', () => {
    it('inserts row and returns entry with id and timestamps', async () => {
      const entry = await repo.add(userId, 'spam@example.com', 'email');
      expect(entry.id).toBeDefined();
      expect(entry.userId).toBe(userId);
      expect(entry.value).toBe('spam@example.com');
      expect(entry.type).toBe('email');
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it('adds a domain-type entry', async () => {
      const entry = await repo.add(userId, 'spammy.com', 'domain');
      expect(entry.type).toBe('domain');
    });

    it('duplicate (userId, value) → throws unique constraint error', async () => {
      await repo.add(userId, 'dup@example.com', 'email');
      await expect(repo.add(userId, 'dup@example.com', 'email')).rejects.toMatchObject({
        code: '23505',
      });
    });

    it('same value for different userId is allowed', async () => {
      const otherUserId = await testDb.createUser();
      await repo.add(userId, 'shared@example.com', 'email');
      await expect(repo.add(otherUserId, 'shared@example.com', 'email')).resolves.not.toThrow();
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('deletes the entry and returns true', async () => {
      await repo.add(userId, 'spam@example.com', 'email');
      const result = await repo.remove(userId, 'spam@example.com');
      expect(result).toBe(true);
    });

    it('returns false when entry does not exist', async () => {
      const result = await repo.remove(userId, 'notexist@example.com');
      expect(result).toBe(false);
    });

    it('does not remove entry belonging to another user', async () => {
      const otherUserId = await testDb.createUser();
      await repo.add(otherUserId, 'other@example.com', 'email');
      const result = await repo.remove(userId, 'other@example.com');
      expect(result).toBe(false);
    });
  });

  // ── isBlacklisted ─────────────────────────────────────────────────────────

  describe('isBlacklisted()', () => {
    it('returns false when email and domain are not in the blacklist', async () => {
      const result = await repo.isBlacklisted(userId, 'clean@example.com');
      expect(result).toBe(false);
    });

    it('returns true when the exact email address is blacklisted', async () => {
      await repo.add(userId, 'spam@example.com', 'email');
      const result = await repo.isBlacklisted(userId, 'spam@example.com');
      expect(result).toBe(true);
    });

    it('returns true when the email domain is blacklisted', async () => {
      await repo.add(userId, 'spammy.com', 'domain');
      const result = await repo.isBlacklisted(userId, 'anyone@spammy.com');
      expect(result).toBe(true);
    });

    it('domain check is scoped to userId', async () => {
      const otherUserId = await testDb.createUser();
      await repo.add(otherUserId, 'spammy.com', 'domain');
      // userId has NOT blacklisted spammy.com
      const result = await repo.isBlacklisted(userId, 'anyone@spammy.com');
      expect(result).toBe(false);
    });

    it('subdomain of blacklisted domain is NOT matched (exact domain only)', async () => {
      await repo.add(userId, 'spammy.com', 'domain');
      const result = await repo.isBlacklisted(userId, 'user@sub.spammy.com');
      expect(result).toBe(false);
    });
  });

  // ── listByUser ────────────────────────────────────────────────────────────

  describe('listByUser()', () => {
    it('returns all blacklist entries for a user', async () => {
      await repo.add(userId, 'a@example.com', 'email');
      await repo.add(userId, 'spammy.com', 'domain');
      const entries = await repo.listByUser(userId);
      expect(entries).toHaveLength(2);
    });

    it('does not include entries from other users', async () => {
      const otherUserId = await testDb.createUser();
      await repo.add(otherUserId, 'other@example.com', 'email');
      await repo.add(userId, 'mine@example.com', 'email');
      const entries = await repo.listByUser(userId);
      expect(entries.every((e) => e.userId === userId)).toBe(true);
    });

    it('returns empty array when user has no blacklist entries', async () => {
      const entries = await repo.listByUser(userId);
      expect(entries).toHaveLength(0);
    });
  });
});

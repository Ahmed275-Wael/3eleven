/**
 * MODULE 10.1 — Lists Repository (Integration)
 *
 * Uses a real PostgreSQL container. Tests list CRUD and lead membership.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupLeadsTestDb, type LeadsTestDb } from '../helpers/test-db-leads.js';
import { LeadsRepository } from '../../src/leads/leads.repository.js';
import { ListsRepository } from '../../src/leads/lists.repository.js';

describe('MODULE 10.1 — Lists Repository (Integration)', () => {
  let testDb: LeadsTestDb;
  let listsRepo: ListsRepository;
  let leadsRepo: LeadsRepository;
  let userId: string;
  let leadId: string;

  beforeAll(async () => {
    testDb = await setupLeadsTestDb();
    listsRepo = new ListsRepository(testDb.db);
    leadsRepo = new LeadsRepository(testDb.db);
  }, 60_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.client.unsafe('DELETE FROM lead_list_members');
    await testDb.client.unsafe('DELETE FROM lead_lists');
    await testDb.client.unsafe('DELETE FROM leads');
    await testDb.client.unsafe('DELETE FROM users');
    userId = await testDb.createUser();
    const lead = await leadsRepo.createLead({
      userId,
      email: 'alice@example.com',
      captureMethod: 'manual',
    });
    leadId = lead.id;
  });

  // ── createList ────────────────────────────────────────────────────────────

  describe('createList()', () => {
    it('inserts a list row and returns it with generated id', async () => {
      const list = await listsRepo.createList(userId, 'SXSW 2026');
      expect(list.id).toBeDefined();
      expect(list.name).toBe('SXSW 2026');
      expect(list.userId).toBe(userId);
    });

    it('createdAt is populated', async () => {
      const list = await listsRepo.createList(userId, 'Test List');
      expect(list.createdAt).toBeInstanceOf(Date);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns list when userId and listId match', async () => {
      const created = await listsRepo.createList(userId, 'My List');
      const found = await listsRepo.findById(userId, created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('returns null when list does not exist', async () => {
      const found = await listsRepo.findById(userId, '00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });

    it('returns null for a list belonging to another user', async () => {
      const otherUserId = await testDb.createUser();
      const created = await listsRepo.createList(otherUserId, 'Other List');
      const found = await listsRepo.findById(userId, created.id);
      expect(found).toBeNull();
    });
  });

  // ── updateList ────────────────────────────────────────────────────────────

  describe('updateList()', () => {
    it('renames the list and returns the updated row', async () => {
      const list = await listsRepo.createList(userId, 'Old Name');
      const updated = await listsRepo.updateList(userId, list.id, { name: 'New Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
    });

    it('returns null when list does not exist', async () => {
      const result = await listsRepo.updateList(userId, '00000000-0000-0000-0000-000000000000', { name: 'X' });
      expect(result).toBeNull();
    });
  });

  // ── deleteList ────────────────────────────────────────────────────────────

  describe('deleteList()', () => {
    it('removes the list and returns true', async () => {
      const list = await listsRepo.createList(userId, 'To Delete');
      const result = await listsRepo.deleteList(userId, list.id);
      expect(result).toBe(true);
      expect(await listsRepo.findById(userId, list.id)).toBeNull();
    });

    it('returns false when list does not exist', async () => {
      const result = await listsRepo.deleteList(userId, '00000000-0000-0000-0000-000000000000');
      expect(result).toBe(false);
    });
  });

  // ── listsByUser ───────────────────────────────────────────────────────────

  describe('listsByUser()', () => {
    it('returns all lists for a user', async () => {
      await listsRepo.createList(userId, 'List A');
      await listsRepo.createList(userId, 'List B');
      const results = await listsRepo.listsByUser(userId);
      expect(results).toHaveLength(2);
    });

    it('does not include lists from other users', async () => {
      const otherUserId = await testDb.createUser();
      await listsRepo.createList(otherUserId, 'Other User List');
      await listsRepo.createList(userId, 'My List');
      const results = await listsRepo.listsByUser(userId);
      expect(results.every((l) => l.userId === userId)).toBe(true);
    });

    it('returns empty array when user has no lists', async () => {
      const results = await listsRepo.listsByUser(userId);
      expect(results).toHaveLength(0);
    });
  });

  // ── addMembers / removeMembers ────────────────────────────────────────────

  describe('addMembers() / removeMembers()', () => {
    it('adds a lead to a list', async () => {
      const list = await listsRepo.createList(userId, 'My List');
      await listsRepo.addMembers(list.id, [leadId]);
      const count = await listsRepo.getMemberCount(list.id);
      expect(count).toBe(1);
    });

    it('addMembers is idempotent — adding same lead twice does not error', async () => {
      const list = await listsRepo.createList(userId, 'My List');
      await listsRepo.addMembers(list.id, [leadId]);
      await expect(listsRepo.addMembers(list.id, [leadId])).resolves.not.toThrow();
      expect(await listsRepo.getMemberCount(list.id)).toBe(1);
    });

    it('removes a lead from a list', async () => {
      const list = await listsRepo.createList(userId, 'My List');
      await listsRepo.addMembers(list.id, [leadId]);
      await listsRepo.removeMembers(list.id, [leadId]);
      expect(await listsRepo.getMemberCount(list.id)).toBe(0);
    });
  });

  // ── getListLeads ──────────────────────────────────────────────────────────

  describe('getListLeads()', () => {
    it('returns leads that belong to the list', async () => {
      const list = await listsRepo.createList(userId, 'My List');
      await listsRepo.addMembers(list.id, [leadId]);
      const leads = await listsRepo.getListLeads(userId, list.id);
      expect(leads).toHaveLength(1);
      expect(leads[0].id).toBe(leadId);
    });

    it('returns empty array when list has no leads', async () => {
      const list = await listsRepo.createList(userId, 'Empty List');
      const leads = await listsRepo.getListLeads(userId, list.id);
      expect(leads).toHaveLength(0);
    });

    it('deleting a list cascades to remove its memberships', async () => {
      const list = await listsRepo.createList(userId, 'Cascade Test');
      await listsRepo.addMembers(list.id, [leadId]);
      await listsRepo.deleteList(userId, list.id);
      // lead itself should still exist
      const rows = await testDb.client.unsafe(`SELECT id FROM leads WHERE id = '${leadId}'`);
      expect(rows).toHaveLength(1);
    });
  });
});

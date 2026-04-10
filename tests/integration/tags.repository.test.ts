/**
 * MODULE 12.1 — Tags Repository (Integration)
 *
 * Uses a real PostgreSQL container. Tests lead tag CRUD operations.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupLeadsTestDb, type LeadsTestDb } from '../helpers/test-db-leads.js';
import { LeadsRepository } from '../../src/leads/leads.repository.js';
import { TagsRepository } from '../../src/leads/tags.repository.js';

describe('MODULE 12.1 — Tags Repository (Integration)', () => {
  let testDb: LeadsTestDb;
  let tagsRepo: TagsRepository;
  let leadsRepo: LeadsRepository;
  let userId: string;
  let leadId: string;

  beforeAll(async () => {
    testDb = await setupLeadsTestDb();
    tagsRepo = new TagsRepository(testDb.db);
    leadsRepo = new LeadsRepository(testDb.db);
  }, 60_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.client.unsafe('DELETE FROM lead_tags');
    await testDb.client.unsafe('DELETE FROM leads');
    await testDb.client.unsafe('DELETE FROM users');
    userId = await testDb.createUser();
    const lead = await leadsRepo.createLead({ userId, email: 'alice@example.com', captureMethod: 'manual' });
    leadId = lead.id;
  });

  // ── addTag ────────────────────────────────────────────────────────────────

  describe('addTag()', () => {
    it('inserts a (leadId, tag) pair', async () => {
      await tagsRepo.addTag(leadId, 'hot');
      const tags = await tagsRepo.getLeadTags(leadId);
      expect(tags).toContain('hot');
    });

    it('adding same tag twice is idempotent (no duplicate error)', async () => {
      await tagsRepo.addTag(leadId, 'hot');
      await expect(tagsRepo.addTag(leadId, 'hot')).resolves.not.toThrow();
      const tags = await tagsRepo.getLeadTags(leadId);
      expect(tags.filter((t) => t === 'hot')).toHaveLength(1);
    });

    it('a lead can have multiple distinct tags', async () => {
      await tagsRepo.addTag(leadId, 'hot');
      await tagsRepo.addTag(leadId, 'CEO');
      await tagsRepo.addTag(leadId, 'SXSW-2026');
      const tags = await tagsRepo.getLeadTags(leadId);
      expect(tags).toHaveLength(3);
    });
  });

  // ── removeTag ─────────────────────────────────────────────────────────────

  describe('removeTag()', () => {
    it('removes the specified tag from a lead', async () => {
      await tagsRepo.addTag(leadId, 'hot');
      await tagsRepo.addTag(leadId, 'CEO');
      await tagsRepo.removeTag(leadId, 'hot');
      const tags = await tagsRepo.getLeadTags(leadId);
      expect(tags).not.toContain('hot');
      expect(tags).toContain('CEO');
    });

    it('removing a non-existent tag does not throw', async () => {
      await expect(tagsRepo.removeTag(leadId, 'notexist')).resolves.not.toThrow();
    });
  });

  // ── getLeadTags ───────────────────────────────────────────────────────────

  describe('getLeadTags()', () => {
    it('returns empty array when lead has no tags', async () => {
      const tags = await tagsRepo.getLeadTags(leadId);
      expect(tags).toEqual([]);
    });

    it('returns all tags for a lead as strings', async () => {
      await tagsRepo.addTag(leadId, 'foo');
      await tagsRepo.addTag(leadId, 'bar');
      const tags = await tagsRepo.getLeadTags(leadId);
      expect(tags).toHaveLength(2);
      expect(tags.every((t) => typeof t === 'string')).toBe(true);
    });
  });

  // ── deleteLeadTags ────────────────────────────────────────────────────────

  describe('deleteLeadTags()', () => {
    it('removes all tags for a lead', async () => {
      await tagsRepo.addTag(leadId, 'a');
      await tagsRepo.addTag(leadId, 'b');
      await tagsRepo.deleteLeadTags(leadId);
      const tags = await tagsRepo.getLeadTags(leadId);
      expect(tags).toHaveLength(0);
    });
  });

  // ── Cascade behaviour ─────────────────────────────────────────────────────

  describe('Cascade: deleting a lead removes its tags', () => {
    it('deletes lead → tags are also deleted', async () => {
      await tagsRepo.addTag(leadId, 'hot');
      await leadsRepo.deleteLead(userId, leadId);
      const tags = await tagsRepo.getLeadTags(leadId);
      expect(tags).toHaveLength(0);
    });
  });
});

/**
 * MODULE 8.1 — Leads Repository (Integration)
 *
 * Uses a real PostgreSQL container via testcontainers.
 * Tests all CRUD operations and query behaviour for LeadsRepository.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupLeadsTestDb, type LeadsTestDb } from '../helpers/test-db-leads.js';
import { LeadsRepository, type CreateLeadInput } from '../../src/leads/leads.repository.js';
import { DuplicateLeadError } from '../../src/leads/errors/index.js';

describe('MODULE 8.1 — Leads Repository (Integration)', () => {
  let testDb: LeadsTestDb;
  let repo: LeadsRepository;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    testDb = await setupLeadsTestDb();
    repo = new LeadsRepository(testDb.db);
  }, 60_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.client.unsafe('DELETE FROM leads');
    await testDb.client.unsafe('DELETE FROM users');
    userId = await testDb.createUser({ username: 'owner', email: 'owner@test.com' });
    otherUserId = await testDb.createUser({ username: 'other', email: 'other@test.com' });
  });

  const baseLead = (): CreateLeadInput => ({
    userId,
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    company: 'Acme Corp',
    captureMethod: 'manual',
  });

  // ── createLead ────────────────────────────────────────────────────────────

  describe('createLead()', () => {
    it('inserts row and returns full lead object with generated id', async () => {
      const lead = await repo.createLead(baseLead());
      expect(lead.id).toBeDefined();
      expect(lead.email).toBe('alice@example.com');
      expect(lead.firstName).toBe('Alice');
      expect(lead.company).toBe('Acme Corp');
    });

    it('new lead has status="new" by default', async () => {
      const lead = await repo.createLead(baseLead());
      expect(lead.status).toBe('new');
    });

    it('new lead has captureMethod="manual" by default', async () => {
      const lead = await repo.createLead({ ...baseLead(), captureMethod: undefined });
      expect(lead.captureMethod).toBe('manual');
    });

    it('stores UTM parameters correctly', async () => {
      const lead = await repo.createLead({
        ...baseLead(),
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'spring',
      });
      expect(lead.utmSource).toBe('google');
      expect(lead.utmMedium).toBe('cpc');
      expect(lead.utmCampaign).toBe('spring');
    });

    it('stores qualificationAnswers as JSONB', async () => {
      const answers = { budget: '10k-50k', timeline: 'Q2' };
      const lead = await repo.createLead({ ...baseLead(), qualificationAnswers: answers });
      expect(lead.qualificationAnswers).toEqual(answers);
    });

    it('duplicate email for same userId → throws DuplicateLeadError', async () => {
      await repo.createLead(baseLead());
      await expect(repo.createLead(baseLead())).rejects.toThrow(DuplicateLeadError);
    });

    it('same email for different userId → allowed (multi-tenant isolation)', async () => {
      await repo.createLead(baseLead());
      const lead2 = await repo.createLead({ ...baseLead(), userId: otherUserId });
      expect(lead2.id).toBeDefined();
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns lead when id and userId match', async () => {
      const created = await repo.createLead(baseLead());
      const found = await repo.findById(userId, created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('returns null when lead does not exist', async () => {
      const found = await repo.findById(userId, '00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });

    it('returns null when lead belongs to a different user (cross-tenant isolation)', async () => {
      const created = await repo.createLead(baseLead());
      const found = await repo.findById(otherUserId, created.id);
      expect(found).toBeNull();
    });
  });

  // ── findByEmail ───────────────────────────────────────────────────────────

  describe('findByEmail()', () => {
    it('returns lead when userId + email match', async () => {
      await repo.createLead(baseLead());
      const found = await repo.findByEmail(userId, 'alice@example.com');
      expect(found).not.toBeNull();
      expect(found!.email).toBe('alice@example.com');
    });

    it('returns null when email belongs to a different user', async () => {
      await repo.createLead(baseLead());
      const found = await repo.findByEmail(otherUserId, 'alice@example.com');
      expect(found).toBeNull();
    });

    it('returns null when email does not exist', async () => {
      const found = await repo.findByEmail(userId, 'nobody@example.com');
      expect(found).toBeNull();
    });
  });

  // ── updateLead ────────────────────────────────────────────────────────────

  describe('updateLead()', () => {
    it('updates specified fields and returns updated lead', async () => {
      const created = await repo.createLead(baseLead());
      const updated = await repo.updateLead(userId, created.id, { company: 'NewCo', jobTitle: 'CEO' });
      expect(updated).not.toBeNull();
      expect(updated!.company).toBe('NewCo');
      expect(updated!.jobTitle).toBe('CEO');
    });

    it('does not overwrite un-patched fields', async () => {
      const created = await repo.createLead(baseLead());
      const updated = await repo.updateLead(userId, created.id, { company: 'NewCo' });
      expect(updated!.firstName).toBe('Alice');
    });

    it('returns null when lead does not exist', async () => {
      const updated = await repo.updateLead(userId, '00000000-0000-0000-0000-000000000000', { company: 'X' });
      expect(updated).toBeNull();
    });

    it('returns null when lead belongs to a different user', async () => {
      const created = await repo.createLead(baseLead());
      const updated = await repo.updateLead(otherUserId, created.id, { company: 'X' });
      expect(updated).toBeNull();
    });
  });

  // ── deleteLead ────────────────────────────────────────────────────────────

  describe('deleteLead()', () => {
    it('removes the row and returns true', async () => {
      const created = await repo.createLead(baseLead());
      const deleted = await repo.deleteLead(userId, created.id);
      expect(deleted).toBe(true);
      expect(await repo.findById(userId, created.id)).toBeNull();
    });

    it('returns false when lead does not exist', async () => {
      const result = await repo.deleteLead(userId, '00000000-0000-0000-0000-000000000000');
      expect(result).toBe(false);
    });

    it('returns false when lead belongs to a different user', async () => {
      const created = await repo.createLead(baseLead());
      const result = await repo.deleteLead(otherUserId, created.id);
      expect(result).toBe(false);
    });
  });

  // ── listLeads ─────────────────────────────────────────────────────────────

  describe('listLeads()', () => {
    it('returns only leads belonging to the userId', async () => {
      await repo.createLead(baseLead());
      await repo.createLead({ ...baseLead(), email: 'bob@example.com', userId: otherUserId });
      const results = await repo.listLeads(userId);
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('alice@example.com');
    });

    it('filters by status', async () => {
      await repo.createLead(baseLead());
      const lead2 = await repo.createLead({ ...baseLead(), email: 'bob@example.com' });
      await repo.updateLead(userId, lead2.id, { status: 'contacted' });
      const results = await repo.listLeads(userId, { status: 'contacted' });
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('contacted');
    });

    it('filters by captureMethod', async () => {
      await repo.createLead(baseLead());
      await repo.createLead({ ...baseLead(), email: 'form@example.com', captureMethod: 'form' });
      const results = await repo.listLeads(userId, { captureMethod: 'form' });
      expect(results).toHaveLength(1);
      expect(results[0].captureMethod).toBe('form');
    });

    it('returns results ordered by capturedAt descending (newest first)', async () => {
      const a = await repo.createLead(baseLead());
      await new Promise((r) => setTimeout(r, 10));
      const b = await repo.createLead({ ...baseLead(), email: 'bob@example.com' });
      const results = await repo.listLeads(userId);
      expect(results[0].id).toBe(b.id);
    });

    it('respects limit and offset pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.createLead({ ...baseLead(), email: `lead${i}@example.com` });
      }
      const page = await repo.listLeads(userId, {}, { limit: 2, offset: 2 });
      expect(page).toHaveLength(2);
    });
  });

  // ── countLeads ────────────────────────────────────────────────────────────

  describe('countLeads()', () => {
    it('counts all leads for a user', async () => {
      await repo.createLead(baseLead());
      await repo.createLead({ ...baseLead(), email: 'bob@example.com' });
      expect(await repo.countLeads(userId)).toBe(2);
    });

    it('count is scoped to userId', async () => {
      await repo.createLead(baseLead());
      await repo.createLead({ ...baseLead(), email: 'other@example.com', userId: otherUserId });
      expect(await repo.countLeads(userId)).toBe(1);
    });

    it('count respects filters', async () => {
      await repo.createLead(baseLead());
      const lead2 = await repo.createLead({ ...baseLead(), email: 'b@example.com' });
      await repo.updateLead(userId, lead2.id, { status: 'won' });
      expect(await repo.countLeads(userId, { status: 'won' })).toBe(1);
    });
  });
});

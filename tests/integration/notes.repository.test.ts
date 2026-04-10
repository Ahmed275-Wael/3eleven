/**
 * MODULE 13.1 — Notes Repository (Integration)
 *
 * Uses a real PostgreSQL container. Tests note creation, retrieval, and deletion.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupLeadsTestDb, type LeadsTestDb } from '../helpers/test-db-leads.js';
import { LeadsRepository } from '../../src/leads/leads.repository.js';
import { NotesRepository } from '../../src/leads/notes.repository.js';

describe('MODULE 13.1 — Notes Repository (Integration)', () => {
  let testDb: LeadsTestDb;
  let notesRepo: NotesRepository;
  let leadsRepo: LeadsRepository;
  let userId: string;
  let leadId: string;

  beforeAll(async () => {
    testDb = await setupLeadsTestDb();
    notesRepo = new NotesRepository(testDb.db);
    leadsRepo = new LeadsRepository(testDb.db);
  }, 60_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.client.unsafe('DELETE FROM lead_notes');
    await testDb.client.unsafe('DELETE FROM leads');
    await testDb.client.unsafe('DELETE FROM users');
    userId = await testDb.createUser();
    const lead = await leadsRepo.createLead({ userId, email: 'alice@example.com', captureMethod: 'manual' });
    leadId = lead.id;
  });

  // ── createNote ────────────────────────────────────────────────────────────

  describe('createNote()', () => {
    it('inserts a note row and returns it with id and timestamps', async () => {
      const note = await notesRepo.createNote(leadId, 'Called today — very interested', userId);
      expect(note.id).toBeDefined();
      expect(note.leadId).toBe(leadId);
      expect(note.body).toBe('Called today — very interested');
      expect(note.createdAt).toBeInstanceOf(Date);
    });

    it('stores createdBy (author) when provided', async () => {
      const note = await notesRepo.createNote(leadId, 'Body', userId);
      expect(note.createdBy).toBe(userId);
    });

    it('createdBy is null when not provided', async () => {
      const note = await notesRepo.createNote(leadId, 'Anonymous note');
      expect(note.createdBy).toBeNull();
    });

    it('a lead can have multiple notes', async () => {
      await notesRepo.createNote(leadId, 'Note 1', userId);
      await notesRepo.createNote(leadId, 'Note 2', userId);
      const notes = await notesRepo.getLeadNotes(leadId);
      expect(notes).toHaveLength(2);
    });
  });

  // ── getLeadNotes ──────────────────────────────────────────────────────────

  describe('getLeadNotes()', () => {
    it('returns empty array when lead has no notes', async () => {
      const notes = await notesRepo.getLeadNotes(leadId);
      expect(notes).toEqual([]);
    });

    it('returns notes ordered by createdAt ascending (oldest first)', async () => {
      const n1 = await notesRepo.createNote(leadId, 'First note', userId);
      await new Promise((r) => setTimeout(r, 10));
      const n2 = await notesRepo.createNote(leadId, 'Second note', userId);
      const notes = await notesRepo.getLeadNotes(leadId);
      expect(notes[0].id).toBe(n1.id);
      expect(notes[1].id).toBe(n2.id);
    });

    it('only returns notes for the requested leadId', async () => {
      const otherLead = await leadsRepo.createLead({ userId, email: 'bob@example.com', captureMethod: 'manual' });
      await notesRepo.createNote(otherLead.id, 'Other lead note', userId);
      await notesRepo.createNote(leadId, 'My lead note', userId);
      const notes = await notesRepo.getLeadNotes(leadId);
      expect(notes).toHaveLength(1);
      expect(notes[0].body).toBe('My lead note');
    });
  });

  // ── deleteNote ────────────────────────────────────────────────────────────

  describe('deleteNote()', () => {
    it('removes a note by id and returns true', async () => {
      const note = await notesRepo.createNote(leadId, 'To delete', userId);
      const result = await notesRepo.deleteNote(note.id);
      expect(result).toBe(true);
      const notes = await notesRepo.getLeadNotes(leadId);
      expect(notes).toHaveLength(0);
    });

    it('returns false when note does not exist', async () => {
      const result = await notesRepo.deleteNote('00000000-0000-0000-0000-000000000000');
      expect(result).toBe(false);
    });
  });

  // ── Cascade ───────────────────────────────────────────────────────────────

  describe('Cascade: deleting a lead removes its notes', () => {
    it('deletes lead → notes are also deleted', async () => {
      await notesRepo.createNote(leadId, 'Note A', userId);
      await leadsRepo.deleteLead(userId, leadId);
      const notes = await notesRepo.getLeadNotes(leadId);
      expect(notes).toHaveLength(0);
    });
  });
});

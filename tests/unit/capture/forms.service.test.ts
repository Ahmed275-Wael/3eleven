/**
 * MODULE 10.1 — Forms Service (Unit)
 *
 * Tests business logic in FormsService with all dependencies mocked.
 * No database or containers required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormsService } from '../../../src/capture/forms.service.js';
import {
  FormNotFoundError,
  InvalidFormOperationError,
} from '../../../src/capture/errors/index.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const MOCK_FORM = {
  id: 'form-uuid-1',
  userId: 'user-uuid-1',
  name: 'Trade Show 2026',
  fields: [],
  qualificationConfig: null,
  redirectUrl: null,
  status: 'draft' as const,
  submissionCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeFormsRepo() {
  return {
    createForm: vi.fn().mockResolvedValue(MOCK_FORM),
    findById: vi.fn().mockResolvedValue(MOCK_FORM),
    findPublicById: vi.fn().mockResolvedValue(MOCK_FORM),
    updateForm: vi.fn().mockResolvedValue({ ...MOCK_FORM }),
    updateStatus: vi.fn().mockResolvedValue({ ...MOCK_FORM }),
    deleteForm: vi.fn().mockResolvedValue(true),
    listByUser: vi.fn().mockResolvedValue([MOCK_FORM]),
    incrementSubmissionCount: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MODULE 10.1 — Forms Service (Unit)', () => {
  let repo: ReturnType<typeof makeFormsRepo>;
  let service: FormsService;

  beforeEach(() => {
    repo = makeFormsRepo();
    service = new FormsService(repo);
  });

  // ── createForm ────────────────────────────────────────────────────────────

  describe('createForm', () => {
    it('saves form with status draft by default', async () => {
      const form = await service.createForm('user-uuid-1', { name: 'My Form', fields: [] });
      expect(repo.createForm).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-uuid-1', status: 'draft' }),
      );
      expect(form.status).toBe('draft');
    });

    it('trims whitespace from name', async () => {
      await service.createForm('user-uuid-1', { name: '  My Form  ', fields: [] });
      expect(repo.createForm).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Form' }),
      );
    });

    it('throws FormNotFoundError for empty name after trim', async () => {
      await expect(service.createForm('user-uuid-1', { name: '   ', fields: [] }))
        .rejects.toThrow(FormNotFoundError);
    });
  });

  // ── getForm ───────────────────────────────────────────────────────────────

  describe('getForm', () => {
    it('returns form when found', async () => {
      const form = await service.getForm('user-uuid-1', 'form-uuid-1');
      expect(form.id).toBe('form-uuid-1');
    });

    it('throws FormNotFoundError when repo returns null', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getForm('user-uuid-1', 'missing')).rejects.toThrow(FormNotFoundError);
    });
  });

  // ── updateForm ────────────────────────────────────────────────────────────

  describe('updateForm', () => {
    it('returns updated form', async () => {
      repo.updateForm.mockResolvedValue({ ...MOCK_FORM, name: 'Updated' });
      const form = await service.updateForm('user-uuid-1', 'form-uuid-1', { name: 'Updated' });
      expect(form.name).toBe('Updated');
    });

    it('throws FormNotFoundError when repo returns null', async () => {
      repo.updateForm.mockResolvedValue(null);
      await expect(service.updateForm('user-uuid-1', 'form-uuid-1', { name: 'x' }))
        .rejects.toThrow(FormNotFoundError);
    });
  });

  // ── publishForm ───────────────────────────────────────────────────────────

  describe('publishForm', () => {
    it('transitions form from draft to active', async () => {
      repo.updateStatus.mockResolvedValue({ ...MOCK_FORM, status: 'active' });
      const form = await service.publishForm('user-uuid-1', 'form-uuid-1');
      expect(repo.updateStatus).toHaveBeenCalledWith('user-uuid-1', 'form-uuid-1', 'active');
      expect(form.status).toBe('active');
    });

    it('throws FormNotFoundError when form does not belong to user', async () => {
      repo.updateStatus.mockResolvedValue(null);
      await expect(service.publishForm('user-uuid-1', 'form-uuid-1'))
        .rejects.toThrow(FormNotFoundError);
    });
  });

  // ── archiveForm ───────────────────────────────────────────────────────────

  describe('archiveForm', () => {
    it('transitions form to archived', async () => {
      repo.updateStatus.mockResolvedValue({ ...MOCK_FORM, status: 'archived' });
      const form = await service.archiveForm('user-uuid-1', 'form-uuid-1');
      expect(repo.updateStatus).toHaveBeenCalledWith('user-uuid-1', 'form-uuid-1', 'archived');
      expect(form.status).toBe('archived');
    });

    it('throws FormNotFoundError when form not found', async () => {
      repo.updateStatus.mockResolvedValue(null);
      await expect(service.archiveForm('user-uuid-1', 'missing'))
        .rejects.toThrow(FormNotFoundError);
    });
  });

  // ── deleteForm ────────────────────────────────────────────────────────────

  describe('deleteForm', () => {
    it('deletes a draft form', async () => {
      repo.findById.mockResolvedValue({ ...MOCK_FORM, status: 'draft' });
      repo.deleteForm.mockResolvedValue(true);
      await expect(service.deleteForm('user-uuid-1', 'form-uuid-1')).resolves.toBeUndefined();
    });

    it('throws InvalidFormOperationError when form is active', async () => {
      repo.findById.mockResolvedValue({ ...MOCK_FORM, status: 'active' });
      await expect(service.deleteForm('user-uuid-1', 'form-uuid-1'))
        .rejects.toThrow(InvalidFormOperationError);
    });

    it('throws FormNotFoundError when form not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.deleteForm('user-uuid-1', 'missing'))
        .rejects.toThrow(FormNotFoundError);
    });
  });

  // ── listForms ─────────────────────────────────────────────────────────────

  describe('listForms', () => {
    it('returns all forms for the user', async () => {
      const forms = await service.listForms('user-uuid-1');
      expect(repo.listByUser).toHaveBeenCalledWith('user-uuid-1', undefined);
      expect(forms).toHaveLength(1);
    });

    it('passes status filter to repo', async () => {
      await service.listForms('user-uuid-1', 'active');
      expect(repo.listByUser).toHaveBeenCalledWith('user-uuid-1', 'active');
    });

    it('returns empty array when user has no forms', async () => {
      repo.listByUser.mockResolvedValue([]);
      const forms = await service.listForms('user-uuid-1');
      expect(forms).toHaveLength(0);
    });
  });

  // ── submitForm ────────────────────────────────────────────────────────────

  describe('submitForm', () => {
    it('increments submission count after creating lead', async () => {
      const mockLeadsService = { captureLead: vi.fn().mockResolvedValue({ id: 'lead-1' }) };
      const serviceWithLeads = new FormsService(repo, mockLeadsService as any);

      repo.findPublicById.mockResolvedValue({ ...MOCK_FORM, status: 'active', userId: 'user-uuid-1' });
      await serviceWithLeads.submitForm('form-uuid-1', { email: 'visitor@example.com' });

      expect(repo.incrementSubmissionCount).toHaveBeenCalledWith('form-uuid-1');
      expect(mockLeadsService.captureLead).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'visitor@example.com', captureMethod: 'form' }),
      );
    });

    it('throws FormNotFoundError when form not found or inactive', async () => {
      repo.findPublicById.mockResolvedValue(null);
      await expect(service.submitForm('missing', { email: 'x@x.com' }))
        .rejects.toThrow(FormNotFoundError);
    });

    it('throws FormNotFoundError when form is not active (draft)', async () => {
      repo.findPublicById.mockResolvedValue({ ...MOCK_FORM, status: 'draft' });
      await expect(service.submitForm('form-uuid-1', { email: 'x@x.com' }))
        .rejects.toThrow(FormNotFoundError);
    });
  });
});

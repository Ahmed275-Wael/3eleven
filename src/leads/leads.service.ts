// MODULE 9.1 — Leads Service

import type { LeadsRepository, LeadFilters, LeadPagination, Lead } from './leads.repository.js';
import type { BlacklistRepository } from './blacklist.repository.js';
import type { TagsRepository } from './tags.repository.js';
import type { NotesRepository, LeadNote } from './notes.repository.js';
import type { ListsRepository } from './lists.repository.js';
import {
  DuplicateLeadError,
  BlacklistedLeadError,
  LeadNotFoundError,
  InvalidLeadStatusError,
} from './errors/index.js';
import { LEAD_STATUSES } from './statuses.js';

export interface CaptureLeadInput {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  captureMethod?: string;
  captureSourceId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  qualificationScore?: number;
  qualificationAnswers?: Record<string, unknown>;
}

export class LeadsService {
  constructor(
    private readonly leadsRepo: LeadsRepository,
    private readonly blacklistRepo: BlacklistRepository,
    private readonly tagsRepo: TagsRepository,
    private readonly notesRepo: NotesRepository,
    private readonly listsRepo: ListsRepository,
  ) {}

  async captureLead(input: CaptureLeadInput): Promise<Lead> {
    const email = input.email.toLowerCase();
    const normalised = { ...input, email, captureMethod: input.captureMethod ?? 'manual' };

    const isBlacklisted = await this.blacklistRepo.isBlacklisted(normalised.userId, email);
    if (isBlacklisted) throw new BlacklistedLeadError();

    const existing = await this.leadsRepo.findByEmail(normalised.userId, email);
    if (existing) throw new DuplicateLeadError();

    return this.leadsRepo.createLead(normalised);
  }

  async getLead(userId: string, leadId: string): Promise<Lead> {
    const lead = await this.leadsRepo.findById(userId, leadId);
    if (!lead) throw new LeadNotFoundError();
    return lead;
  }

  async updateLead(
    userId: string,
    leadId: string,
    data: Partial<Omit<CaptureLeadInput, 'userId'>>,
  ): Promise<Lead> {
    const updated = await this.leadsRepo.updateLead(userId, leadId, data);
    if (!updated) throw new LeadNotFoundError();
    return updated;
  }

  async deleteLead(userId: string, leadId: string): Promise<void> {
    const deleted = await this.leadsRepo.deleteLead(userId, leadId);
    if (!deleted) throw new LeadNotFoundError();
  }

  async updateStatus(userId: string, leadId: string, status: string): Promise<Lead> {
    if (!(LEAD_STATUSES as readonly string[]).includes(status)) throw new InvalidLeadStatusError(status);
    const updated = await this.leadsRepo.updateLead(userId, leadId, { status });
    if (!updated) throw new LeadNotFoundError();
    return updated;
  }

  async listLeads(
    userId: string,
    filters: LeadFilters = {},
    pagination: LeadPagination = {},
  ): Promise<{ leads: Lead[]; total: number }> {
    const [leadList, total] = await Promise.all([
      this.leadsRepo.listLeads(userId, filters, pagination),
      this.leadsRepo.countLeads(userId, filters),
    ]);
    return { leads: leadList, total };
  }

  async addTag(userId: string, leadId: string, tag: string): Promise<void> {
    const lead = await this.leadsRepo.findById(userId, leadId);
    if (!lead) throw new LeadNotFoundError();
    await this.tagsRepo.addTag(leadId, tag);
  }

  async removeTag(userId: string, leadId: string, tag: string): Promise<void> {
    const lead = await this.leadsRepo.findById(userId, leadId);
    if (!lead) throw new LeadNotFoundError();
    await this.tagsRepo.removeTag(leadId, tag);
  }

  async addNote(userId: string, leadId: string, body: string): Promise<LeadNote> {
    const lead = await this.leadsRepo.findById(userId, leadId);
    if (!lead) throw new LeadNotFoundError();
    return this.notesRepo.createNote(leadId, body, userId);
  }

  async findLeadByEmail(userId: string, email: string): Promise<Lead | null> {
    return this.leadsRepo.findByEmail(userId, email.toLowerCase());
  }

  async getLeadNotes(userId: string, leadId: string): Promise<LeadNote[]> {
    const lead = await this.leadsRepo.findById(userId, leadId);
    if (!lead) throw new LeadNotFoundError();
    return this.notesRepo.getLeadNotes(leadId);
  }
}

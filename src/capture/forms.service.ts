// MODULE 10.1 — Forms Service

import type { FormsRepository, Form, CreateFormInput } from './forms.repository.js';
import type { LeadsService } from '../leads/leads.service.js';
import type { Lead } from '../leads/leads.repository.js';
import {
  FormNotFoundError,
  InvalidFormOperationError,
} from './errors/index.js';

export interface CreateFormServiceInput {
  name: string;
  fields: unknown[];
  qualificationConfig?: Record<string, unknown>;
  redirectUrl?: string;
}

export interface SubmitFormInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  [key: string]: unknown;
}

export class FormsService {
  constructor(
    private readonly repo: FormsRepository,
    private readonly leadsService?: LeadsService,
  ) {}

  async createForm(userId: string, input: CreateFormServiceInput): Promise<Form> {
    const name = input.name.trim();
    if (!name) throw new FormNotFoundError();
    return this.repo.createForm({ userId, fields: input.fields, status: 'draft', ...input, name });
  }

  async getForm(userId: string, formId: string): Promise<Form> {
    const form = await this.repo.findById(userId, formId);
    if (!form) throw new FormNotFoundError();
    return form;
  }

  async updateForm(
    userId: string,
    formId: string,
    data: Partial<Omit<CreateFormInput, 'userId'>>,
  ): Promise<Form> {
    const form = await this.repo.updateForm(userId, formId, data);
    if (!form) throw new FormNotFoundError();
    return form;
  }

  async publishForm(userId: string, formId: string): Promise<Form> {
    const form = await this.repo.updateStatus(userId, formId, 'active');
    if (!form) throw new FormNotFoundError();
    return form;
  }

  async archiveForm(userId: string, formId: string): Promise<Form> {
    const form = await this.repo.updateStatus(userId, formId, 'archived');
    if (!form) throw new FormNotFoundError();
    return form;
  }

  async deleteForm(userId: string, formId: string): Promise<void> {
    const form = await this.repo.findById(userId, formId);
    if (!form) throw new FormNotFoundError();
    if (form.status !== 'draft') throw new InvalidFormOperationError('Only draft forms can be deleted');
    await this.repo.deleteForm(userId, formId);
  }

  async listForms(userId: string, status?: string): Promise<Form[]> {
    return this.repo.listByUser(userId, status);
  }

  async submitForm(formId: string, data: SubmitFormInput): Promise<Lead> {
    const form = await this.repo.findPublicById(formId);
    if (!form || form.status !== 'active') throw new FormNotFoundError();

    const lead = await this.leadsService!.captureLead({
      userId: form.userId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      company: data.company,
      jobTitle: data.jobTitle,
      captureMethod: 'form',
      captureSourceId: formId,
    });

    await this.repo.incrementSubmissionCount(formId);
    return lead;
  }
}

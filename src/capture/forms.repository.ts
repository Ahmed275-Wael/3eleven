// MODULE 10.1 — Forms Repository

import { eq, and, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { forms } from './db/schema.js';
import type * as captureSchema from './db/schema.js';

export type Form = typeof forms.$inferSelect;

export interface CreateFormInput {
  userId: string;
  name: string;
  fields: unknown[];
  status?: string;
  qualificationConfig?: Record<string, unknown>;
  redirectUrl?: string;
}

export class FormsRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof captureSchema>) {}

  async createForm(input: CreateFormInput): Promise<Form> {
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) values[k] = v;
    }
    const [row] = await this.db
      .insert(forms)
      .values(values as typeof forms.$inferInsert)
      .returning();
    return row;
  }

  async findById(userId: string, formId: string): Promise<Form | null> {
    const [row] = await this.db
      .select()
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.userId, userId)));
    return row ?? null;
  }

  /** Used for public form submission — no userId check, only returns active forms. */
  async findPublicById(formId: string): Promise<Form | null> {
    const [row] = await this.db
      .select()
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.status, 'active')));
    return row ?? null;
  }

  async updateForm(
    userId: string,
    formId: string,
    data: Partial<Omit<CreateFormInput, 'userId'>>,
  ): Promise<Form | null> {
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) values[k] = v;
    }
    if (Object.keys(values).length === 0) return this.findById(userId, formId);
    values.updatedAt = new Date();
    const [row] = await this.db
      .update(forms)
      .set(values as Partial<typeof forms.$inferInsert>)
      .where(and(eq(forms.id, formId), eq(forms.userId, userId)))
      .returning();
    return row ?? null;
  }

  async updateStatus(userId: string, formId: string, status: string): Promise<Form | null> {
    const [row] = await this.db
      .update(forms)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(forms.id, formId), eq(forms.userId, userId)))
      .returning();
    return row ?? null;
  }

  async deleteForm(userId: string, formId: string): Promise<boolean> {
    const result = await this.db
      .delete(forms)
      .where(and(eq(forms.id, formId), eq(forms.userId, userId)))
      .returning({ id: forms.id });
    return result.length > 0;
  }

  async listByUser(userId: string, status?: string): Promise<Form[]> {
    const conditions = [eq(forms.userId, userId)];
    if (status) conditions.push(eq(forms.status, status));
    return this.db
      .select()
      .from(forms)
      .where(and(...conditions));
  }

  /** Atomically increments the submission counter for a form. */
  async incrementSubmissionCount(formId: string): Promise<void> {
    await this.db
      .update(forms)
      .set({ submissionCount: sql`${forms.submissionCount} + 1` })
      .where(eq(forms.id, formId));
  }
}

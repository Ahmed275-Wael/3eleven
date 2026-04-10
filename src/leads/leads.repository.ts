// MODULE 8.1 — Leads Repository

import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { leads } from './db/schema.js';
import { DuplicateLeadError } from './errors/index.js';
import type * as schema from './db/schema.js';

export interface CreateLeadInput {
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
  status?: string;
}

export interface LeadFilters {
  status?: string;
  captureMethod?: string;
}

export interface LeadPagination {
  limit?: number;
  offset?: number;
}

export type Lead = typeof leads.$inferSelect;

export class LeadsRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async createLead(input: CreateLeadInput): Promise<Lead> {
    // Strip undefined values so DB defaults are used for missing columns
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) values[k] = v;
    }
    try {
      const [row] = await this.db
        .insert(leads)
        .values(values as typeof leads.$inferInsert)
        .returning();
      return row;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new DuplicateLeadError();
      }
      throw err;
    }
  }

  async findById(userId: string, id: string): Promise<Lead | null> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)));
    return row ?? null;
  }

  async findByEmail(userId: string, email: string): Promise<Lead | null> {
    const [row] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.userId, userId), eq(leads.email, email)));
    return row ?? null;
  }

  async updateLead(
    userId: string,
    id: string,
    data: Partial<Omit<CreateLeadInput, 'userId'>>,
  ): Promise<Lead | null> {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) values[k] = v;
    }
    const rows = await this.db
      .update(leads)
      .set(values as any)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)))
      .returning();
    return rows[0] ?? null;
  }

  async deleteLead(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, userId)))
      .returning({ id: leads.id });
    return rows.length > 0;
  }

  async listLeads(
    userId: string,
    filters: LeadFilters = {},
    pagination: LeadPagination = {},
  ): Promise<Lead[]> {
    const conditions = this.buildConditions(userId, filters);
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    return this.db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.capturedAt))
      .limit(limit)
      .offset(offset);
  }

  async countLeads(userId: string, filters: LeadFilters = {}): Promise<number> {
    const conditions = this.buildConditions(userId, filters);
    const [row] = await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(leads)
      .where(and(...conditions));
    return row?.count ?? 0;
  }

  private buildConditions(userId: string, filters: LeadFilters): SQL[] {
    const conditions: SQL[] = [eq(leads.userId, userId)];
    if (filters.status) conditions.push(eq(leads.status, filters.status));
    if (filters.captureMethod) conditions.push(eq(leads.captureMethod, filters.captureMethod));
    return conditions;
  }
}

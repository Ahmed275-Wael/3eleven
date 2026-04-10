// MODULE 10.1 — Lists Repository

import { eq, and, inArray, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { leads, leadLists, leadListMembers } from './db/schema.js';
import type * as schema from './db/schema.js';

export type LeadList = typeof leadLists.$inferSelect;

export class ListsRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async createList(userId: string, name: string): Promise<LeadList> {
    const [row] = await this.db
      .insert(leadLists)
      .values({ userId, name })
      .returning();
    return row;
  }

  async findById(userId: string, listId: string): Promise<LeadList | null> {
    const [row] = await this.db
      .select()
      .from(leadLists)
      .where(and(eq(leadLists.id, listId), eq(leadLists.userId, userId)));
    return row ?? null;
  }

  async updateList(
    userId: string,
    listId: string,
    data: Partial<{ name: string }>,
  ): Promise<LeadList | null> {
    const rows = await this.db
      .update(leadLists)
      .set(data)
      .where(and(eq(leadLists.id, listId), eq(leadLists.userId, userId)))
      .returning();
    return rows[0] ?? null;
  }

  async deleteList(userId: string, listId: string): Promise<boolean> {
    const rows = await this.db
      .delete(leadLists)
      .where(and(eq(leadLists.id, listId), eq(leadLists.userId, userId)))
      .returning({ id: leadLists.id });
    return rows.length > 0;
  }

  async listsByUser(userId: string): Promise<LeadList[]> {
    return this.db.select().from(leadLists).where(eq(leadLists.userId, userId));
  }

  async addMembers(listId: string, leadIds: string[]): Promise<void> {
    if (leadIds.length === 0) return;
    await this.db
      .insert(leadListMembers)
      .values(leadIds.map((leadId) => ({ leadId, listId })))
      .onConflictDoNothing();
  }

  async removeMembers(listId: string, leadIds: string[]): Promise<void> {
    if (leadIds.length === 0) return;
    await this.db
      .delete(leadListMembers)
      .where(
        and(
          eq(leadListMembers.listId, listId),
          inArray(leadListMembers.leadId, leadIds),
        ),
      );
  }

  async getListLeads(userId: string, listId: string): Promise<(typeof leads.$inferSelect)[]> {
    const rows = await this.db
      .select({ lead: leads })
      .from(leads)
      .innerJoin(leadListMembers, eq(leads.id, leadListMembers.leadId))
      .where(
        and(
          eq(leadListMembers.listId, listId),
          eq(leads.userId, userId),
        ),
      );
    return rows.map((r) => r.lead);
  }

  async getMemberCount(listId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(leadListMembers)
      .where(eq(leadListMembers.listId, listId));
    return row?.count ?? 0;
  }
}

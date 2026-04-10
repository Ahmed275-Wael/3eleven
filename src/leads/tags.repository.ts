// MODULE 12.1 — Tags Repository

import { eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { leadTags } from './db/schema.js';
import type * as schema from './db/schema.js';

export class TagsRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async addTag(leadId: string, tag: string): Promise<void> {
    await this.db
      .insert(leadTags)
      .values({ leadId, tag })
      .onConflictDoNothing();
  }

  async removeTag(leadId: string, tag: string): Promise<void> {
    await this.db
      .delete(leadTags)
      .where(and(eq(leadTags.leadId, leadId), eq(leadTags.tag, tag)));
  }

  async getLeadTags(leadId: string): Promise<string[]> {
    const rows = await this.db
      .select({ tag: leadTags.tag })
      .from(leadTags)
      .where(eq(leadTags.leadId, leadId));
    return rows.map((r) => r.tag);
  }

  async deleteLeadTags(leadId: string): Promise<void> {
    await this.db.delete(leadTags).where(eq(leadTags.leadId, leadId));
  }
}

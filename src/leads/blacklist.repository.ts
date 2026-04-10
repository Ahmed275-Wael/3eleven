// MODULE 14.1 — Blacklist Repository

import { eq, and, or } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { leadBlacklist } from './db/schema.js';
import type * as schema from './db/schema.js';

export type BlacklistEntry = typeof leadBlacklist.$inferSelect;

export class BlacklistRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async add(userId: string, value: string, type: 'email' | 'domain'): Promise<BlacklistEntry> {
    const [row] = await this.db
      .insert(leadBlacklist)
      .values({ userId, value, type })
      .returning();
    return row;
  }

  async remove(userId: string, value: string): Promise<boolean> {
    const rows = await this.db
      .delete(leadBlacklist)
      .where(and(eq(leadBlacklist.userId, userId), eq(leadBlacklist.value, value)))
      .returning({ id: leadBlacklist.id });
    return rows.length > 0;
  }

  async isBlacklisted(userId: string, email: string): Promise<boolean> {
    const domain = email.split('@')[1] ?? '';
    const [row] = await this.db
      .select({ id: leadBlacklist.id })
      .from(leadBlacklist)
      .where(
        and(
          eq(leadBlacklist.userId, userId),
          or(
            and(eq(leadBlacklist.type, 'email'), eq(leadBlacklist.value, email)),
            and(eq(leadBlacklist.type, 'domain'), eq(leadBlacklist.value, domain)),
          ),
        ),
      );
    return !!row;
  }

  async listByUser(userId: string): Promise<BlacklistEntry[]> {
    return this.db
      .select()
      .from(leadBlacklist)
      .where(eq(leadBlacklist.userId, userId));
  }
}

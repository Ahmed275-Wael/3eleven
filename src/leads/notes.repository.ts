// MODULE 13.1 — Notes Repository

import { eq, asc } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { leadNotes } from './db/schema.js';
import type * as schema from './db/schema.js';

export type LeadNote = typeof leadNotes.$inferSelect;

export class NotesRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async createNote(leadId: string, body: string, createdBy?: string): Promise<LeadNote> {
    const [row] = await this.db
      .insert(leadNotes)
      .values({ leadId, body, createdBy: createdBy ?? null })
      .returning();
    return row;
  }

  async getLeadNotes(leadId: string): Promise<LeadNote[]> {
    return this.db
      .select()
      .from(leadNotes)
      .where(eq(leadNotes.leadId, leadId))
      .orderBy(asc(leadNotes.createdAt));
  }

  async deleteNote(noteId: string): Promise<boolean> {
    const rows = await this.db
      .delete(leadNotes)
      .where(eq(leadNotes.id, noteId))
      .returning({ id: leadNotes.id });
    return rows.length > 0;
  }
}

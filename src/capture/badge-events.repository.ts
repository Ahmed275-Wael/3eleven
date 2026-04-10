// MODULE 10.2 — Badge Events Repository

import { eq, and, asc } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { badgeEvents, badgeAttendees } from './db/schema.js';
import type * as captureSchema from './db/schema.js';

export type BadgeEvent = typeof badgeEvents.$inferSelect;
export type BadgeAttendee = typeof badgeAttendees.$inferSelect;

export interface CreateEventInput {
  userId: string;
  name: string;
  eventDate?: string;
}

export interface AttendeeInput {
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  jobTitle?: string;
}

export class BadgeEventsRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof captureSchema>) {}

  async createEvent(input: CreateEventInput): Promise<BadgeEvent> {
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) values[k] = v;
    }
    const [row] = await this.db
      .insert(badgeEvents)
      .values(values as typeof badgeEvents.$inferInsert)
      .returning();
    return row;
  }

  async findEventById(userId: string, eventId: string): Promise<BadgeEvent | null> {
    const [row] = await this.db
      .select()
      .from(badgeEvents)
      .where(and(eq(badgeEvents.id, eventId), eq(badgeEvents.userId, userId)));
    return row ?? null;
  }

  async listEventsByUser(userId: string): Promise<BadgeEvent[]> {
    return this.db
      .select()
      .from(badgeEvents)
      .where(eq(badgeEvents.userId, userId));
  }

  /**
   * Bulk-inserts attendees with conflict on (event_id, email) → do nothing.
   * Returns the number of rows actually inserted.
   */
  async addAttendees(eventId: string, attendees: AttendeeInput[]): Promise<number> {
    if (attendees.length === 0) return 0;
    const rows = attendees.map((a) => ({ eventId, ...a }));
    const inserted = await this.db
      .insert(badgeAttendees)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: badgeAttendees.id });
    return inserted.length;
  }

  async getAttendees(eventId: string): Promise<BadgeAttendee[]> {
    return this.db
      .select()
      .from(badgeAttendees)
      .where(eq(badgeAttendees.eventId, eventId))
      .orderBy(asc(badgeAttendees.createdAt));
  }

  async findAttendeeById(eventId: string, attendeeId: string): Promise<BadgeAttendee | null> {
    const [row] = await this.db
      .select()
      .from(badgeAttendees)
      .where(and(eq(badgeAttendees.id, attendeeId), eq(badgeAttendees.eventId, eventId)));
    return row ?? null;
  }

  async scanAttendee(attendeeId: string, leadId: string): Promise<void> {
    await this.db
      .update(badgeAttendees)
      .set({ scannedAt: new Date(), leadId })
      .where(eq(badgeAttendees.id, attendeeId));
  }

  async deleteEvent(userId: string, eventId: string): Promise<boolean> {
    const result = await this.db
      .delete(badgeEvents)
      .where(and(eq(badgeEvents.id, eventId), eq(badgeEvents.userId, userId)))
      .returning({ id: badgeEvents.id });
    return result.length > 0;
  }
}

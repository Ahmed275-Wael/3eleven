// MODULE 6.3 — Security Event Logger

import { eq, desc } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { securityEvents } from '../db/schema.js';
import type * as schema from '../db/schema.js';

export interface SecurityEvent {
  id: string;
  userId: string;
  eventType: string;
  ipAddress: string;
  userAgent: string | null;
  riskLevel: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface LogEventInput {
  userId: string;
  type: string;
  ip: string;
  userAgent?: string;
  riskLevel: string;
  metadata?: Record<string, unknown>;
}

export class SecurityEventsRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async logEvent(input: LogEventInput): Promise<SecurityEvent> {
    const [row] = await this.db
      .insert(securityEvents)
      .values({
        userId: input.userId,
        eventType: input.type,
        ipAddress: input.ip,
        userAgent: input.userAgent ?? null,
        riskLevel: input.riskLevel,
        metadata: input.metadata ?? null,
      })
      .returning();
    return this.toEvent(row);
  }

  async getRecentEvents(userId: string, limit: number): Promise<SecurityEvent[]> {
    const rows = await this.db
      .select()
      .from(securityEvents)
      .where(eq(securityEvents.userId, userId))
      .orderBy(desc(securityEvents.createdAt))
      .limit(limit);
    return rows.map((r) => this.toEvent(r));
  }

  private toEvent(row: typeof securityEvents.$inferSelect): SecurityEvent {
    return {
      id: row.id,
      userId: row.userId!,
      eventType: row.eventType,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      riskLevel: row.riskLevel,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
    };
  }
}

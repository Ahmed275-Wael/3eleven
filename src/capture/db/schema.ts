import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
// Cross-module FK constraints enforced in migration SQL for module isolation.

// ─── forms ───
export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → users.id (CASCADE DELETE enforced in migration SQL)
    userId: uuid('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    // Array of field config objects:
    // { id, type, label, required, placeholder?, options?: string[] }
    // types: 'text' | 'email' | 'phone' | 'company' | 'dropdown' | 'checkbox' | 'file'
    fields: jsonb('fields').notNull().default('[]'),
    // qualification config: { questions: [{id, text, type, options?}], weights: {[questionId]: number} }
    qualificationConfig: jsonb('qualification_config'),
    redirectUrl: varchar('redirect_url', { length: 1000 }),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    // 'draft' | 'active' | 'archived'
    // view count lives in Redis as form:views:{formId} — no DB write per page load
    submissionCount: integer('submission_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdIdx: index('forms_user_id_idx').on(t.userId),
    userStatusIdx: index('forms_user_status_idx').on(t.userId, t.status),
  }),
);

// ─── badge_events ───
export const badgeEvents = pgTable(
  'badge_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → users.id (CASCADE DELETE enforced in migration SQL)
    userId: uuid('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    eventDate: date('event_date'),
    // FK → forms.id (SET NULL enforced in migration SQL)
    qualificationFormId: uuid('qualification_form_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ userIdIdx: index('badge_events_user_id_idx').on(t.userId) }),
);

// ─── badge_attendees ───
export const badgeAttendees = pgTable(
  'badge_attendees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → badge_events.id (CASCADE DELETE enforced in migration SQL)
    eventId: uuid('event_id').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    company: varchar('company', { length: 255 }),
    jobTitle: varchar('job_title', { length: 255 }),
    // Local path or S3 key of the generated badge PDF. Null until generated.
    badgePdfPath: varchar('badge_pdf_path', { length: 1000 }),
    // Set when the badge QR is scanned at the event.
    scannedAt: timestamp('scanned_at', { withTimezone: true }),
    // FK → leads.id (SET NULL enforced in migration SQL) — set after scan creates a lead record.
    leadId: uuid('lead_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    eventIdIdx: index('badge_attendees_event_id_idx').on(t.eventId),
    eventEmailUnique: uniqueIndex('badge_attendees_event_email_unique').on(t.eventId, t.email),
  }),
);

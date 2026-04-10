import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
// Cross-module FK constraints (→ users.id, etc.) are defined as plain uuid columns
// and enforced at the DB level via migration SQL rather than .references() to
// preserve module isolation (drizzle-kit cannot resolve cross-module .js imports).

// ─── leads ───
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → users.id (CASCADE DELETE enforced in migration SQL)
    userId: uuid('user_id').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    phone: varchar('phone', { length: 50 }),
    company: varchar('company', { length: 255 }),
    jobTitle: varchar('job_title', { length: 255 }),
    // capture attribution
    captureMethod: varchar('capture_method', { length: 20 })
      .notNull()
      .default('manual'),
    // 'form' | 'badge_scan' | 'qr' | 'manual' | 'import'
    captureSourceId: varchar('capture_source_id', { length: 100 }),
    // formId, eventId, or null
    // UTM parameters
    utmSource: varchar('utm_source', { length: 255 }),
    utmMedium: varchar('utm_medium', { length: 255 }),
    utmCampaign: varchar('utm_campaign', { length: 255 }),
    utmContent: varchar('utm_content', { length: 255 }),
    utmTerm: varchar('utm_term', { length: 255 }),
    // qualification
    qualificationScore: integer('qualification_score'),
    qualificationAnswers: jsonb('qualification_answers'),
    // pipeline
    status: varchar('status', { length: 30 }).notNull().default('new'),
    // 'new' | 'contacted' | 'qualified' | 'meeting_booked' | 'won' | 'lost'
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdIdx: index('leads_user_id_idx').on(t.userId),
    userEmailUnique: uniqueIndex('leads_user_email_unique').on(t.userId, t.email),
    userStatusIdx: index('leads_user_status_idx').on(t.userId, t.status),
    userMethodIdx: index('leads_user_method_idx').on(t.userId, t.captureMethod),
    userCapturedAtIdx: index('leads_user_captured_at_idx').on(t.userId, t.capturedAt),
  }),
);

// ─── lead_lists ───
export const leadLists = pgTable(
  'lead_lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → users.id (CASCADE DELETE enforced in migration SQL)
    userId: uuid('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ userIdIdx: index('lead_lists_user_id_idx').on(t.userId) }),
);

// ─── lead_list_members (many-to-many) ───
export const leadListMembers = pgTable(
  'lead_list_members',
  {
    // FKs → leads.id, lead_lists.id (CASCADE DELETE enforced in migration SQL)
    leadId: uuid('lead_id').notNull(),
    listId: uuid('list_id').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.leadId, t.listId] }),
    listIdIdx: index('lead_list_members_list_id_idx').on(t.listId),
  }),
);

// ─── lead_tags ───
export const leadTags = pgTable(
  'lead_tags',
  {
    // FK → leads.id (CASCADE DELETE enforced in migration SQL)
    leadId: uuid('lead_id').notNull(),
    tag: varchar('tag', { length: 100 }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.leadId, t.tag] }),
    tagIdx: index('lead_tags_tag_idx').on(t.tag),
  }),
);

// ─── lead_notes ───
export const leadNotes = pgTable(
  'lead_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → leads.id (CASCADE DELETE enforced in migration SQL)
    leadId: uuid('lead_id').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // FK → users.id (SET NULL enforced in migration SQL)
    createdBy: uuid('created_by'),
  },
  (t) => ({ leadIdIdx: index('lead_notes_lead_id_idx').on(t.leadId, t.createdAt) }),
);

// ─── lead_blacklist ───
export const leadBlacklist = pgTable(
  'lead_blacklist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → users.id (CASCADE DELETE enforced in migration SQL)
    userId: uuid('user_id').notNull(),
    value: varchar('value', { length: 255 }).notNull(),
    type: varchar('type', { length: 10 }).notNull(),
    // 'email' | 'domain'
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userValueUnique: uniqueIndex('lead_blacklist_user_value_unique').on(t.userId, t.value),
    userTypeIdx: index('lead_blacklist_user_type_idx').on(t.userId, t.type),
  }),
);

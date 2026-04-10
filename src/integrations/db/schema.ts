import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
// Cross-module FK constraints enforced in migration SQL for module isolation.

// ─── integrations ───
// OAuth tokens are stored AES-256-GCM encrypted (via INTEGRATION_ENCRYPTION_KEY env var).
// The DB never holds plaintext OAuth tokens.
export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → users.id (CASCADE DELETE enforced in migration SQL)
    userId: uuid('user_id').notNull(),
    provider: varchar('provider', { length: 20 }).notNull(),
    // 'hubspot' | 'salesforce' | 'pipedrive'
    // Stored AES-256-GCM encrypted — format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    // Salesforce only — instance URL varies per org (e.g. https://mycompany.salesforce.com)
    salesforceInstanceUrl: varchar('salesforce_instance_url', { length: 500 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    // 'active' | 'disconnected' | 'error'
    connectedAt: timestamp('connected_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdIdx: index('integrations_user_id_idx').on(t.userId),
    // A user can only have one active connection per provider
    userProviderUnique: uniqueIndex('integrations_user_provider_unique').on(t.userId, t.provider),
  }),
);

// ─── integration_field_maps ───
export const integrationFieldMaps = pgTable(
  'integration_field_maps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    // Our canonical field name: 'firstName' | 'lastName' | 'email' | 'phone' |
    // 'company' | 'jobTitle' | 'qualificationScore' | 'status' | custom field key
    ourField: varchar('our_field', { length: 100 }).notNull(),
    // CRM-side field name e.g. 'firstname', 'company', 'hs_lead_score'
    crmField: varchar('crm_field', { length: 255 }).notNull(),
    // Optional transform: 'uppercase' | 'lowercase' | 'combine_name' etc.
    transformFn: varchar('transform_fn', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ integrationIdIdx: index('integration_field_maps_integration_id_idx').on(t.integrationId) }),
);

// ─── lead_sync_log ───
// One row per (lead, integration) — tracks CRM push status.
export const leadSyncLog = pgTable(
  'lead_sync_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → leads.id (CASCADE DELETE enforced in migration SQL)
    leadId: uuid('lead_id').notNull(),
    // FK → integrations.id (CASCADE DELETE enforced in migration SQL)
    integrationId: uuid('integration_id').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    // 'pending' | 'synced' | 'failed' | 'skipped'
    // The ID of the created/updated record on the CRM side.
    crmRecordId: varchar('crm_record_id', { length: 255 }),
    attempts: integer('attempts').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (t) => ({
    leadIdIdx: index('lead_sync_log_lead_id_idx').on(t.leadId),
    integrationStatusIdx: index('lead_sync_log_integration_status_idx').on(t.integrationId, t.status),
    leadIntegrationUnique: uniqueIndex('lead_sync_log_lead_integration_unique').on(
      t.leadId,
      t.integrationId,
    ),
  }),
);

// ─── webhooks ───
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → users.id (CASCADE DELETE enforced in migration SQL)
    userId: uuid('user_id').notNull(),
    url: varchar('url', { length: 2000 }).notNull(),
    // Array of event strings: ['lead.captured', 'lead.updated', 'lead.qualified']
    events: text('events').array().notNull().default([]),
    // HMAC-SHA256 signing secret — stored plaintext (it is our generated key, not a user
    // credential). The user uses this to verify incoming webhook signatures.
    secret: varchar('secret', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    // 'active' | 'paused'
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ userIdIdx: index('webhooks_user_id_idx').on(t.userId) }),
);

// ─── webhook_deliveries ───
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // FK → webhooks.id (CASCADE DELETE enforced in migration SQL)
    webhookId: uuid('webhook_id').notNull(),
    // FK → leads.id (SET NULL enforced in migration SQL)
    leadId: uuid('lead_id'),
    event: varchar('event', { length: 50 }).notNull(),
    statusCode: integer('status_code'),
    // Capped at 1000 chars to prevent runaway storage from verbose error responses
    responseBody: varchar('response_body', { length: 1000 }),
    attempt: integer('attempt').notNull().default(1),
    success: boolean('success').notNull().default(false),
    deliveredAt: timestamp('delivered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    webhookIdIdx: index('webhook_deliveries_webhook_id_idx').on(t.webhookId, t.deliveredAt),
    successIdx: index('webhook_deliveries_success_idx').on(t.webhookId, t.success),
  }),
);

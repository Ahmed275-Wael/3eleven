import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/security/db/schema.ts',
    './src/leads/db/schema.ts',
    './src/capture/db/schema.ts',
    './src/integrations/db/schema.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

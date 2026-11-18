import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: (
      process.env.TURSO_DATABASE_URL ??
      process.env.TURSO_DATABASE_URL_PROD ??
      'file:./local.db'
    ).replace(/^file:/, ''),
  },
});

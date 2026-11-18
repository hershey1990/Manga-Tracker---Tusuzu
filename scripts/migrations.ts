import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type MigrationFile = {
  name: string;
  statements: string[];
};

export const readMigrationFiles = (folder = './drizzle'): MigrationFile[] =>
  readdirSync(folder)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      statements: readFileSync(join(folder, name), 'utf8')
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0),
    }));

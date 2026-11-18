import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
};

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const series = sqliteTable(
  'series',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: ['manga', 'anime'] }).notNull(),
    title: text('title').notNull(),
    normalizedTitle: text('normalized_title').notNull(),
    titleRomaji: text('title_romaji'),
    titleNative: text('title_native'),
    description: text('description'),
    coverImage: text('cover_image'),
    publicationStatus: text('publication_status'),
    year: integer('year'),
    totalUnits: integer('total_units'),
    genres: text('genres', { mode: 'json' }).$type<string[]>(),
    sourceUrl: text('source_url'),
    provider: text('provider'),
    providerId: text('provider_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('series_normalized_title_idx').on(table.normalizedTitle),
    uniqueIndex('series_provider_unique_idx').on(
      table.provider,
      table.providerId,
    ),
  ],
);

export const seriesAlias = sqliteTable(
  'series_alias',
  {
    id: text('id').primaryKey(),
    seriesId: text('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    normalizedAlias: text('normalized_alias').notNull(),
  },
  (table) => [
    uniqueIndex('series_alias_unique_idx').on(
      table.seriesId,
      table.normalizedAlias,
    ),
    index('series_alias_normalized_idx').on(table.normalizedAlias),
  ],
);

export const libraryEntry = sqliteTable(
  'library_entry',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    seriesId: text('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    status: text('status', {
      enum: ['planning', 'in_progress', 'completed', 'paused', 'dropped'],
    })
      .notNull()
      .default('planning'),
    progress: integer('progress').notNull().default(0),
    totalUnitsOverride: integer('total_units_override'),
    score: integer('score'),
    isFavorite: integer('is_favorite', { mode: 'boolean' })
      .notNull()
      .default(false),
    notes: text('notes'),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('library_entry_user_series_idx').on(
      table.userId,
      table.seriesId,
    ),
    index('library_entry_user_status_idx').on(table.userId, table.status),
    index('library_entry_user_updated_idx').on(table.userId, table.updatedAt),
  ],
);

export const importJob = sqliteTable(
  'import_job',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    status: text('status', { enum: ['preview', 'applied', 'failed'] })
      .notNull()
      .default('preview'),
    total: integer('total').notNull().default(0),
    imported: integer('imported').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    report: text('report', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
  },
  (table) => [index('import_job_user_idx').on(table.userId)],
);

export const importEntry = sqliteTable(
  'import_entry',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => importJob.id, { onDelete: 'cascade' }),
    sourceFile: text('source_file').notNull(),
    rawTitle: text('raw_title').notNull(),
    normalizedTitle: text('normalized_title').notNull(),
    seriesId: text('series_id').references(() => series.id, {
      onDelete: 'set null',
    }),
    outcome: text('outcome', {
      enum: ['new', 'duplicate', 'existing', 'imported', 'skipped', 'failed'],
    })
      .notNull()
      .default('new'),
    message: text('message'),
    payload: text('payload', { mode: 'json' }),
  },
  (table) => [index('import_entry_job_idx').on(table.jobId)],
);

export const providerCache = sqliteTable('provider_cache', {
  key: text('key').primaryKey(),
  payload: text('payload', { mode: 'json' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Series = typeof series.$inferSelect;
export type NewSeries = typeof series.$inferInsert;
export type LibraryEntry = typeof libraryEntry.$inferSelect;
export type NewLibraryEntry = typeof libraryEntry.$inferInsert;

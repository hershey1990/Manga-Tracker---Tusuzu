import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import {
  importEntry,
  importJob,
  libraryEntry,
  series,
} from '../../lib/db/schema';
import { normalizeTitle } from '../../lib/text';
import type { SeriesType } from '../series/schema';
import type { VaultExport } from './parser';

const CHUNK = 80;

const chunked = <T>(items: T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
};

const existingTitles = async (userId: string) => {
  const rows = await db
    .select({ normalizedTitle: series.normalizedTitle })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(eq(libraryEntry.userId, userId));
  return new Set(rows.map((row) => row.normalizedTitle));
};

const isHttpUrl = (value: string | null): string | null =>
  value && /^https?:\/\//i.test(value) ? value : null;

export type PreviewRow = {
  id: string;
  file: string;
  title: string;
  type: SeriesType;
  status: VaultExport[number]['status'];
  progress: number;
  outcome: 'new' | 'duplicate' | 'existing';
  message: string | null;
};

export type ImportPreview = {
  jobId: string;
  total: number;
  newCount: number;
  duplicateCount: number;
  existingCount: number;
  warningCount: number;
  rows: PreviewRow[];
};

export const createPreview = async (
  userId: string,
  records: VaultExport,
  source = 'obsidian-vault',
): Promise<ImportPreview> => {
  const existing = await existingTitles(userId);
  const seen = new Map<string, string>();
  const jobId = crypto.randomUUID();

  const rows: PreviewRow[] = records.map((record) => {
    const normalized = normalizeTitle(record.title);
    let outcome: PreviewRow['outcome'] = 'new';
    let message: string | null =
      record.warnings.length > 0 ? record.warnings.join(' · ') : null;

    if (existing.has(normalized)) {
      outcome = 'existing';
      message = message ?? 'Ya está en tu biblioteca';
    } else if (seen.has(normalized)) {
      outcome = 'duplicate';
      message = message ?? `Duplicado de ${seen.get(normalized)}`;
    } else {
      seen.set(normalized, record.file);
    }

    return {
      id: crypto.randomUUID(),
      file: record.file,
      title: record.title,
      type: record.type,
      status: record.status,
      progress: record.chapter,
      outcome,
      message,
    };
  });

  const now = new Date();
  await db.insert(importJob).values({
    id: jobId,
    userId,
    source,
    status: 'preview',
    total: records.length,
    createdAt: now,
  });

  for (const batch of chunked(
    rows.map((row, index) => ({ row, record: records[index]! })),
  )) {
    await db.insert(importEntry).values(
      batch.map(({ row, record }) => ({
        id: row.id,
        jobId,
        sourceFile: row.file,
        rawTitle: row.title,
        normalizedTitle: normalizeTitle(row.title),
        outcome: row.outcome,
        message: row.message,
        payload: record as never,
      })),
    );
  }

  return {
    jobId,
    total: rows.length,
    newCount: rows.filter((row) => row.outcome === 'new').length,
    duplicateCount: rows.filter((row) => row.outcome === 'duplicate').length,
    existingCount: rows.filter((row) => row.outcome === 'existing').length,
    warningCount: rows.filter((row) => row.message).length,
    rows: rows.slice(0, 60),
  };
};

export type ImportReport = {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
};

export const applyImport = async (
  userId: string,
  jobId: string,
): Promise<ImportReport> => {
  const [job] = await db
    .select()
    .from(importJob)
    .where(and(eq(importJob.id, jobId), eq(importJob.userId, userId)))
    .limit(1);

  if (!job) throw new Error('Importación no encontrada');
  if (job.status !== 'preview') {
    throw new Error('Esta importación ya fue procesada');
  }

  const entries = await db
    .select()
    .from(importEntry)
    .where(eq(importEntry.jobId, jobId))
    .orderBy(importEntry.sourceFile);

  const existing = await existingTitles(userId);
  const now = new Date();
  const failures: { id: string; message: string }[] = [];
  const seen = new Set<string>();
  const eligible: typeof entries = [];

  for (const entry of entries) {
    if (
      entry.outcome === 'duplicate' ||
      entry.outcome === 'existing' ||
      existing.has(entry.normalizedTitle)
    ) {
      continue;
    }
    if (seen.has(entry.normalizedTitle)) {
      continue;
    }
    seen.add(entry.normalizedTitle);
    eligible.push(entry);
  }

  const seriesByTitle = new Map<string, string>();
  const insertable = eligible.map((entry) => {
    const id = crypto.randomUUID();
    const payload = (entry.payload ?? {}) as VaultExport[number];
    return {
      id,
      type: (payload.type ?? 'manga') as SeriesType,
      title: payload.title ?? entry.rawTitle,
      normalizedTitle: entry.normalizedTitle,
      sourceUrl: isHttpUrl(payload.url ?? null),
      coverImage: isHttpUrl(payload.image ?? null),
      genres: [] as string[],
      createdAt: now,
      updatedAt: now,
    };
  });

  for (const batch of chunked(insertable)) {
    await db.insert(series).values(batch).onConflictDoNothing();
  }

  const persisted = await db
    .select({ id: series.id, normalizedTitle: series.normalizedTitle })
    .from(series)
    .where(
      inArray(
        series.normalizedTitle,
        insertable.map((row) => row.normalizedTitle),
      ),
    );
  for (const row of persisted) {
    seriesByTitle.set(row.normalizedTitle, row.id);
  }

  const libraryRows = eligible
    .map((entry) => {
      const seriesId = seriesByTitle.get(entry.normalizedTitle);
      if (!seriesId) {
        failures.push({
          id: entry.id,
          message: 'No se pudo resolver la serie',
        });
        return null;
      }
      const payload = (entry.payload ?? {}) as VaultExport[number];
      return {
        id: crypto.randomUUID(),
        userId,
        seriesId,
        status: payload.status ?? ('planning' as const),
        progress: payload.chapter ?? 0,
        notes: payload.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  for (const batch of chunked(libraryRows)) {
    await db.insert(libraryEntry).values(batch).onConflictDoNothing();
  }

  const importedEntries = eligible.filter(
    (entry) =>
      seriesByTitle.has(entry.normalizedTitle) &&
      !failures.some((failure) => failure.id === entry.id),
  );
  for (const batch of chunked(importedEntries)) {
    await db
      .update(importEntry)
      .set({ outcome: 'imported', message: null })
      .where(
        inArray(
          importEntry.id,
          batch.map((entry) => entry.id),
        ),
      );
  }

  for (const failure of failures) {
    await db
      .update(importEntry)
      .set({ outcome: 'failed', message: failure.message })
      .where(eq(importEntry.id, failure.id));
  }

  const report: ImportReport = {
    total: entries.length,
    imported: importedEntries.length,
    skipped: entries.length - importedEntries.length - failures.length,
    failed: failures.length,
  };

  await db
    .update(importJob)
    .set({
      status: 'applied',
      imported: report.imported,
      skipped: report.skipped,
      failed: report.failed,
      report: report as never,
      finishedAt: new Date(),
    })
    .where(eq(importJob.id, jobId));

  return report;
};

export const listImportJobs = async (userId: string) => {
  return db
    .select()
    .from(importJob)
    .where(eq(importJob.userId, userId))
    .orderBy(desc(importJob.createdAt))
    .limit(10);
};

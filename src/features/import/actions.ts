'use server';

import { requireUser } from '../auth/session';
import {
  applyImport,
  createPreview,
  type ImportPreview,
  type ImportReport,
} from './importer';
import { vaultExportSchema } from './parser';

export const previewVaultImport = async (
  json: string,
): Promise<ImportPreview> => {
  const user = await requireUser();

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new Error('El archivo no contiene JSON válido');
  }

  const parsed = vaultExportSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `Formato inválido${issue ? `: ${issue.path.join('.')} ${issue.message}` : ''}`,
    );
  }

  return createPreview(user.id, parsed.data);
};

export const applyVaultImport = async (
  jobId: string,
): Promise<ImportReport> => {
  const user = await requireUser();
  return applyImport(user.id, jobId);
};

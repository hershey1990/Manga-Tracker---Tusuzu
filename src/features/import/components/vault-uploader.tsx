'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '../../../components/ui/button';
import { ProgressBar } from '../../../components/ui/progress';
import { cn } from '../../../lib/cn';
import { enrichMyLibraryBatch } from '../../series/enrichment-actions';
import { applyVaultImport, previewVaultImport } from '../actions';
import type { ImportPreview, ImportReport } from '../importer';

const OUTCOME_META = {
  new: { label: 'Nueva', tone: 'text-mint border-mint/30 bg-mint/10' },
  duplicate: {
    label: 'Duplicada',
    tone: 'text-amber border-amber/30 bg-amber/10',
  },
  existing: {
    label: 'Ya existe',
    tone: 'text-muted border-line bg-surface',
  },
} as const;

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-line bg-surface px-3 py-2">
    <p className="text-[10px] uppercase tracking-[0.1em] text-muted">{label}</p>
    <p className="mt-0.5 text-lg font-semibold text-white">{value}</p>
  </div>
);

export const VaultUploader = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const mountedRef = useRef(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [enrichAfter, setEnrichAfter] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [enrichment, setEnrichment] = useState<{
    total: number;
    processed: number;
    matched: number;
    failed: number;
    remaining: number;
  } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRef.current = true;
    };
  }, []);

  const reset = () => {
    cancelRef.current = true;
    setPreview(null);
    setReport(null);
    setError(null);
    setFileName(null);
    setEnrichment(null);
    setEnriching(false);
    setCancelRequested(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const runEnrichment = async () => {
    cancelRef.current = false;
    setCancelRequested(false);
    setError(null);
    setEnriching(true);
    setEnrichment(null);

    let cursor: string | undefined;
    let processed = 0;
    let matched = 0;
    let failed = 0;
    let initialTotal = 0;
    let remaining = 0;

    try {
      while (!cancelRef.current) {
        const result = await enrichMyLibraryBatch(8, cursor);
        if (!mountedRef.current) return;

        if (processed === 0) {
          initialTotal = result.total;
        }
        processed += result.processed;
        matched += result.matched;
        failed += result.failed;
        remaining = result.remaining;
        cursor = result.nextCursor ?? undefined;

        setEnrichment({
          total: initialTotal,
          processed,
          matched,
          failed,
          remaining,
        });

        if (result.done || result.processed === 0) break;
      }
    } catch (cause) {
      if (mountedRef.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudieron completar las fichas.',
        );
      }
    } finally {
      if (mountedRef.current) {
        setEnriching(false);
      }
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setReport(null);
    setPreview(null);
    setFileName(file.name);

    startTransition(async () => {
      try {
        const text = await file.text();
        const result = await previewVaultImport(text);
        setPreview(result);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo leer el archivo.',
        );
      }
    });
  };

  const apply = () => {
    if (!preview) return;
    if (
      !window.confirm(
        `Se importarán ${preview.newCount} series en tu biblioteca. ¿Continuar?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await applyVaultImport(preview.jobId);
        setReport(result);
        if (enrichAfter) {
          void runEnrichment();
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo aplicar la importación.',
        );
      }
    });
  };

  return (
    <div className="panel space-y-4 p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-white">
          Sube tu exportación
        </h2>
        <p className="text-xs text-muted">
          Acepta el <code className="text-ink">vault-export.json</code> generado
          con{' '}
          <code className="rounded bg-surface px-1 text-ink">
            npm run vault:export
          </code>
          . Nada del vault original se modifica.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={(event) => onFile(event.target.files?.[0])}
        className="block w-full cursor-pointer rounded-lg border border-dashed border-line bg-surface/60 px-3 py-3 text-xs text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:text-ink hover:border-accent/40"
      />

      {fileName ? (
        <p className="text-[11px] text-muted">
          Archivo: <span className="text-ink">{fileName}</span>
        </p>
      ) : null}

      {pending ? <p className="text-xs text-accent">Procesando…</p> : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-[#f7b0c4]"
        >
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Total" value={preview.total} />
            <Stat label="Nuevas" value={preview.newCount} />
            <Stat label="Duplicadas" value={preview.duplicateCount} />
            <Stat label="Ya existentes" value={preview.existingCount} />
          </div>

          {report ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-mint/30 bg-mint/10 px-3 py-2 text-xs text-[#a5f0d6]">
                Importadas {report.imported} · Omitidas {report.skipped} ·
                Fallidas {report.failed}
              </p>

              <div className="space-y-3 rounded-lg border border-line bg-surface/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-ink">
                      Fichas desde AniList
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted">
                      Copia portada, sinopsis, año y totales a tu propia base.
                      AniList solo se consulta aquí; después todo se lee de tu
                      DB.
                    </p>
                  </div>
                  {enriching ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        cancelRef.current = true;
                        setCancelRequested(true);
                      }}
                      disabled={cancelRequested}
                    >
                      {cancelRequested ? 'Cancelando…' : 'Cancelar'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void runEnrichment()}
                      disabled={pending}
                    >
                      {enrichment ? 'Reintentar restantes' : 'Buscar fichas'}
                    </Button>
                  )}
                </div>

                {enrichment ? (
                  <div className="space-y-2">
                    <ProgressBar
                      value={enrichment.processed}
                      max={enrichment.total}
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span>
                        {enrichment.processed} de {enrichment.total} revisadas
                      </span>
                      <span className="text-mint">
                        {enrichment.matched} vinculadas
                      </span>
                      {enrichment.failed > 0 ? (
                        <span className="text-rose">
                          {enrichment.failed} errores
                        </span>
                      ) : null}
                      <span>
                        {enrichment.remaining} sin coincidencia/pendientes
                      </span>
                    </div>
                    {!enriching && enrichment.remaining > 0 ? (
                      <p className="text-[11px] leading-relaxed text-muted/80">
                        Las que no coinciden por título exacto quedan sin
                        proveedor. Puedes crearlas manualmente o reintentar más
                        tarde.
                      </p>
                    ) : null}
                  </div>
                ) : enriching ? (
                  <p className="text-[11px] text-accent">
                    Buscando coincidencias en AniList…
                  </p>
                ) : (
                  <p className="text-[11px] text-muted">
                    Puedes completar las fichas ahora o más tarde desde Admin.
                  </p>
                )}

                {!enriching && enrichment && enrichment.processed > 0 ? (
                  <a
                    href="/library"
                    className="focus-ring inline-flex h-8 w-fit items-center rounded-lg border border-line bg-surface px-3 text-[11px] text-ink hover:border-[#323a52]"
                  >
                    Ver biblioteca
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-80 overflow-auto rounded-lg border border-line">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="sticky top-0 bg-surface-raised text-[10px] uppercase tracking-[0.08em] text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Título</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium">Progreso</th>
                      <th className="px-3 py-2 font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/50">
                    {preview.rows.map((row) => {
                      const meta = OUTCOME_META[row.outcome];
                      return (
                        <tr key={row.id}>
                          <td className="px-3 py-2">
                            <p className="max-w-[260px] truncate text-ink">
                              {row.title}
                            </p>
                            {row.message ? (
                              <p className="text-[10px] text-amber/90">
                                {row.message}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-muted">{row.status}</td>
                          <td className="px-3 py-2 text-muted">
                            {row.progress}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px]',
                                meta.tone,
                              )}
                            >
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {preview.total > preview.rows.length ? (
                <p className="text-[11px] text-muted">
                  Mostrando {preview.rows.length} de {preview.total} filas.
                </p>
              ) : null}

              <label className="flex items-start gap-2 rounded-lg border border-line bg-surface/60 p-3 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={enrichAfter}
                  onChange={(event) => setEnrichAfter(event.target.checked)}
                  className="mt-0.5 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="text-ink">
                    Buscar portadas y fichas en AniList al terminar.
                  </span>{' '}
                  Se copian a tu base, así que no dependes de AniList para
                  verlas. Puede tardar varios minutos y puedes cancelar.
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={apply}
                  disabled={pending || preview.newCount === 0}
                >
                  Importar {preview.newCount} series
                </Button>
                <Button variant="secondary" onClick={reset} disabled={pending}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

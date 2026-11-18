'use client';

import { useState, useTransition } from 'react';
import { Button } from '../../../components/ui/button';
import { useFlash } from '../../../lib/flash';
import { adminEnrichUnlinked, adminRefreshMetadata } from '../actions';

type Result = { processed: number; updated: number; failed: number };

const seriesText = (count: number) =>
  count === 1 ? '1 serie' : `${count} series`;

export const MetadataTools = ({
  missingCovers,
  unlinked,
}: {
  missingCovers: number;
  unlinked: number;
}) => {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<'refresh' | 'enrich' | null>(null);
  const [message, setMessage] = useFlash('admin:metadata');
  const [error, setError] = useState<string | null>(null);

  const run = (kind: 'refresh' | 'enrich', limit: number) => {
    setMessage(null);
    setError(null);
    setBusy(kind);
    startTransition(async () => {
      try {
        const result: Result =
          kind === 'refresh'
            ? await adminRefreshMetadata(limit)
            : await adminEnrichUnlinked(limit);
        setMessage(
          `Procesadas ${result.processed} · actualizadas ${result.updated} · fallidas ${result.failed}.`,
        );
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'No se pudo completar.',
        );
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <div className="panel space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">
            Enriquecer series importadas
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Busca en AniList por título exacto y vincula portada, sinopsis y
            totales. {seriesText(unlinked)} sin proveedor{' '}
            {unlinked === 1 ? 'espera' : 'esperan'}. Procesa 10 por clic para
            respetar el rate limit.
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || unlinked === 0}
            onClick={() => run('enrich', 10)}
          >
            {busy === 'enrich' ? 'Buscando…' : 'Enriquecer 10'}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">
            Refrescar metadatos existentes
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Vuelve a pedir a AniList portada y sinopsis de series ya vinculadas
            que las tengan vacías. {seriesText(missingCovers)} sin portada.
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || missingCovers === 0}
            onClick={() => run('refresh', 10)}
          >
            {busy === 'refresh' ? 'Actualizando…' : 'Refrescar 10'}
          </Button>
        </div>
      </div>

      {message ? <p className="text-xs text-mint">{message}</p> : null}
      {error ? <p className="text-xs text-rose">{error}</p> : null}
    </div>
  );
};

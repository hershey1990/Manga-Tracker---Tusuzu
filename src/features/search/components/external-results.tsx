'use client';

import { useEffect, useState, useTransition } from 'react';
import { Link, useRouter } from 'waku';
import { TypeBadge } from '../../../components/ui/badge';
import { Cover } from '../../../components/ui/cover';
import { PlusIcon, SparkIcon } from '../../../components/ui/icons';
import { cn } from '../../../lib/cn';
import { useFlash } from '../../../lib/flash';
import { getSavedProviderLinks } from '../../library/actions';
import { PROVIDER_STATUS_LABELS, unitLabel } from '../../series/schema';
import { addProviderSeries, searchProvider } from '../actions';
import type { ProviderSeries } from '../types';

const ProviderCard = ({
  item,
  added,
  seriesId,
  onAdd,
}: {
  item: ProviderSeries;
  added: boolean;
  seriesId?: string | undefined;
  onAdd: () => void;
}) => (
  <div className="group space-y-2.5">
    <div className="relative overflow-hidden rounded-xl">
      <Cover src={item.coverImage} title={item.title} type={item.type} />
      <button
        type="button"
        onClick={onAdd}
        disabled={added}
        className={cn(
          'focus-ring absolute inset-x-2 bottom-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold backdrop-blur transition-colors',
          added
            ? 'bg-mint/20 text-[#a5f0d6]'
            : 'bg-accent/90 text-void hover:bg-[#87a1ff]',
        )}
      >
        <PlusIcon className="size-3.5" />
        {added ? 'En tu lista' : 'Añadir'}
      </button>
    </div>
    <div className="space-y-1">
      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
        {item.title}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        <TypeBadge type={item.type} />
        <span>{item.year ?? '—'}</span>
        {item.totalUnits ? (
          <span>
            · {item.totalUnits} {unitLabel(item.type)}
          </span>
        ) : null}
      </div>
      {item.publicationStatus ? (
        <p className="text-[11px] text-muted/70">
          {PROVIDER_STATUS_LABELS[item.publicationStatus] ??
            item.publicationStatus}
        </p>
      ) : null}
      {seriesId ? (
        <Link
          to={`/series/${seriesId}`}
          className="focus-ring inline-flex rounded text-[11px] font-medium text-accent hover:underline"
        >
          Ver ficha local
        </Link>
      ) : null}
    </div>
  </div>
);

export const ExternalResults = ({
  query,
  type,
}: {
  query: string;
  type: 'all' | 'manga' | 'anime';
}) => {
  const router = useRouter();
  const [results, setResults] = useState<ProviderSeries[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const [notice, setNotice] = useFlash('search:add');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void searchProvider(query, type)
      .then(async (outcome) => {
        if (cancelled) return;
        setResults(outcome.results);
        setError(outcome.error);
        if (outcome.results.length > 0) {
          const savedLinks = await getSavedProviderLinks(
            outcome.results.map((item) => item.providerId),
          );
          if (!cancelled) {
            setSaved(new Set(savedLinks.map((item) => item.providerId)));
            setLinks(
              new Map(
                savedLinks.map((item) => [item.providerId, item.seriesId]),
              ),
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo consultar AniList.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, type]);

  const add = (item: ProviderSeries) => {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await addProviderSeries(item.providerId, item.type);
        setSaved((current) => new Set(current).add(item.providerId));
        setLinks((current) =>
          new Map(current).set(item.providerId, result.seriesId),
        );
        setNotice(
          result.linkedExisting
            ? 'Guardado en tu base: actualicé la ficha local que ya tenías con los datos de AniList.'
            : result.createdSeries
              ? 'Guardado en tu base local y añadido a tu biblioteca.'
              : 'Ya estaba en tu biblioteca; no se duplicó.',
        );
        // Refresh the server-rendered local results so the new series appears
        // in "En tu biblioteca" without a manual reload.
        router.reload();
      } catch {
        setError('No se pudo añadir la serie.');
      }
    });
  };

  if (query.trim().length < 2) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
            <SparkIcon className="size-4 text-accent" />
            Resultados de AniList
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Metadatos, portadas y totales oficiales.
          </p>
        </div>
        {loading ? <span className="text-xs text-muted">Buscando…</span> : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-[#f3cc85]">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-mint/30 bg-mint/10 px-3 py-2 text-xs text-[#a5f0d6]"
        >
          {notice}
        </p>
      ) : null}

      {!loading && results.length === 0 && !error ? (
        <p className="panel px-4 py-8 text-center text-xs text-muted">
          Sin resultados en AniList. Prueba otro título o créala manualmente.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {results.map((item) => (
          <ProviderCard
            key={`${item.type}-${item.providerId}`}
            item={item}
            added={saved.has(item.providerId)}
            seriesId={links.get(item.providerId)}
            onAdd={() => add(item)}
          />
        ))}
      </div>

      {pending ? (
        <p className="text-xs text-muted">Guardando en tu biblioteca…</p>
      ) : null}
    </section>
  );
};

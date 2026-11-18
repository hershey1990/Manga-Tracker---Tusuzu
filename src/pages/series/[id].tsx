import { Link } from 'waku';
import type { PageProps } from 'waku/router';
import { requestNotFound } from 'waku/router/server';
import { StatusBadge, TypeBadge } from '../../components/ui/badge';
import { Cover } from '../../components/ui/cover';
import { ArrowLeftIcon, BookIcon } from '../../components/ui/icons';
import { requireUserOrRedirect } from '../../features/auth/session';
import {
  AddToLibraryButton,
  EntryEditor,
} from '../../features/library/components/entry-editor';
import { getEntryBySeries } from '../../features/library/queries';
import {
  getSeriesById,
  listSeriesAliases,
} from '../../features/series/queries';
import {
  PROVIDER_STATUS_LABELS,
  unitLabel,
  unitName,
} from '../../features/series/schema';

export default async function SeriesPage({ id }: PageProps<'/series/[id]'>) {
  const user = await requireUserOrRedirect(`/series/${id}`);
  const item = await getSeriesById(id);

  if (!item) {
    requestNotFound();
    return null;
  }

  const [entry, aliases] = await Promise.all([
    getEntryBySeries(user.id, item.id),
    listSeriesAliases(item.id),
  ]);

  const unit = unitLabel(item.type);
  const altTitles = [item.titleRomaji, item.titleNative].filter(
    (value): value is string => Boolean(value) && value !== item.title,
  );
  const shownAliases = aliases
    .map((alias) => alias.alias)
    .filter((alias) => alias !== item.title && !altTitles.includes(alias))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <Link
        to="/library"
        className="focus-ring inline-flex items-center gap-1.5 rounded text-xs text-muted transition-colors hover:text-ink"
      >
        <ArrowLeftIcon className="size-3.5" />
        Volver a la biblioteca
      </Link>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="mx-auto w-44 sm:w-52 lg:w-full">
            <Cover
              src={item.coverImage}
              title={item.title}
              type={item.type}
              sizes="(max-width: 1024px) 200px, 260px"
            />
          </div>

          <div className="panel space-y-3 p-4 text-xs text-muted">
            <div className="flex items-center justify-between">
              <span>Tipo</span>
              <TypeBadge type={item.type} />
            </div>
            <div className="flex items-center justify-between">
              <span>Año</span>
              <span className="text-ink">{item.year ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span className="text-ink">
                {item.totalUnits
                  ? `${item.totalUnits} ${unitName(item.type, item.totalUnits)}`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Publicación</span>
              <span className="text-ink">
                {item.publicationStatus
                  ? (PROVIDER_STATUS_LABELS[item.publicationStatus] ??
                    item.publicationStatus)
                  : '—'}
              </span>
            </div>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="focus-ring inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink transition-colors hover:border-[#323a52]"
              >
                {item.provider === 'anilist'
                  ? 'Abrir en AniList'
                  : 'Ver en el proveedor'}
              </a>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {entry ? (
                <StatusBadge status={entry.status} type={entry.type} />
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] text-muted">
                  <BookIcon className="size-3" />
                  No está en tu biblioteca
                </span>
              )}
              {item.genres?.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-muted"
                >
                  {genre}
                </span>
              ))}
            </div>

            <div>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
                {item.title}
              </h1>
              {altTitles.length > 0 ? (
                <p className="mt-1 text-sm text-muted">
                  {altTitles.join(' · ')}
                </p>
              ) : null}
              {shownAliases.length > 0 ? (
                <p className="mt-1 text-[11px] text-muted/70">
                  También conocido como: {shownAliases.join(' · ')}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-muted/70">
                {item.provider
                  ? `Ficha guardada en tu base · copia local de ${item.provider}`
                  : 'Serie local · sin proveedor vinculado'}
              </p>
            </div>
          </header>

          {entry ? (
            <EntryEditor entry={entry} unit={unit} />
          ) : (
            <AddToLibraryButton seriesId={item.id} />
          )}

          {item.description ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-white">Sinopsis</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                {item.description}
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const getConfig = async () => {
  return { render: 'dynamic' } as const;
};

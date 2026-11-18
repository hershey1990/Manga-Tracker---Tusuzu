import { Link } from 'waku';
import type { PageProps } from 'waku/router';
import { TypeBadge } from '../components/ui/badge';
import { Cover } from '../components/ui/cover';
import { LibraryIcon } from '../components/ui/icons';
import { requireUserOrRedirect } from '../features/auth/session';
import { ExternalResults } from '../features/search/components/external-results';
import { ManualSeriesForm } from '../features/search/components/manual-form';
import { SearchForm } from '../features/search/components/search-form';
import { searchLocalSeries } from '../features/series/queries';

export default async function SearchPage({ query }: PageProps<'/search'>) {
  await requireUserOrRedirect('/search');

  const params = new URLSearchParams(query ?? '');
  const q = params.get('q')?.trim() ?? '';
  const rawType = params.get('type');
  const type: 'all' | 'manga' | 'anime' =
    rawType === 'manga' || rawType === 'anime' ? rawType : 'all';

  const local = q ? await searchLocalSeries(q, type) : [];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Descubrir
        </h1>
        <p className="text-sm text-muted">
          Busca en tu biblioteca o trae metadatos desde AniList.
        </p>
      </header>

      <SearchForm initialQuery={q} initialType={type} />

      {q ? (
        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
              <LibraryIcon className="size-4 text-mint" />
              En tu biblioteca
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {local.length === 0
                ? 'Sin coincidencias locales. Si aparece en AniList, añádela abajo y quedará guardada en tu base.'
                : `${local.length} ${local.length === 1 ? 'coincidencia' : 'coincidencias'}.`}
            </p>
          </div>

          {local.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {local.map((item) => (
                <Link
                  key={item.id}
                  to={`/series/${item.id}`}
                  className="focus-ring group space-y-2 rounded-xl"
                >
                  <Cover
                    src={item.coverImage}
                    title={item.title}
                    type={item.type}
                  />
                  <div className="space-y-1">
                    <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink group-hover:text-white">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      <TypeBadge type={item.type} />
                      <span>{item.year ?? '—'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <div className="panel px-6 py-12 text-center">
          <p className="text-sm font-medium text-ink">
            Empieza escribiendo un título
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            También puedes pegar el nombre de una serie que tengas en Obsidian
            para ver si ya la importaste.
          </p>
        </div>
      )}

      {q ? <ExternalResults query={q} type={type} /> : null}

      <ManualSeriesForm title={q} />
    </div>
  );
}

export const getConfig = async () => {
  return { render: 'dynamic' } as const;
};

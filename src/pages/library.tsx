import { Link } from 'waku';
import type { PageProps } from 'waku/router';
import { BookIcon, PlusIcon } from '../components/ui/icons';
import { EmptyState } from '../components/ui/stat-card';
import { requireUserOrRedirect } from '../features/auth/session';
import { LibraryFiltersBar } from '../features/library/components/library-filters';
import { LibraryTable } from '../features/library/components/library-table';
import { Pagination } from '../features/library/components/pagination';
import { getLibraryStats, listLibrary } from '../features/library/queries';
import { libraryFilterSchema } from '../features/library/schema';
import { SeriesCard } from '../features/series/components/series-card';

export default async function LibraryPage({ query }: PageProps<'/library'>) {
  const user = await requireUserOrRedirect('/library');
  const params = new URLSearchParams(query ?? '');
  const parsed = libraryFilterSchema.safeParse(
    Object.fromEntries(params.entries()),
  );
  const filters = parsed.success ? parsed.data : libraryFilterSchema.parse({});
  const view = params.get('view') === 'table' ? 'table' : 'grid';

  const [result, stats] = await Promise.all([
    listLibrary(user.id, filters),
    getLibraryStats(user.id),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Biblioteca
          </h1>
          <p className="mt-1 text-sm text-muted">
            {result.total === 0
              ? 'Sin resultados para este filtro.'
              : `${result.total} ${result.total === 1 ? 'serie' : 'series'} en esta vista.`}
          </p>
        </div>
        <Link
          to="/search"
          className="focus-ring inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-accent px-3 text-xs font-semibold text-void hover:bg-[#87a1ff]"
        >
          <PlusIcon className="size-4" />
          Añadir
        </Link>
      </header>

      <LibraryFiltersBar filters={filters} view={view} stats={stats} />

      {result.items.length === 0 ? (
        <EmptyState
          icon={<BookIcon className="size-5" />}
          title="Nada por aquí"
          description="Prueba con otro filtro o añade una serie nueva desde la búsqueda."
          action={
            <Link
              to="/search"
              className="focus-ring inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-void hover:bg-[#87a1ff]"
            >
              Buscar series
            </Link>
          }
        />
      ) : view === 'table' ? (
        <LibraryTable items={result.items} filters={filters} view={view} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {result.items.map((item) => (
            <SeriesCard key={item.entryId} item={item} />
          ))}
        </div>
      )}

      <Pagination
        filters={filters}
        view={view}
        total={result.total}
        pageSize={result.pageSize}
      />
    </div>
  );
}

export const getConfig = async () => {
  return { render: 'dynamic' } as const;
};

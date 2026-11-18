import { Link } from 'waku';
import { cn } from '../../../lib/cn';
import type { LibraryFilters } from '../schema';

export const Pagination = ({
  filters,
  view,
  total,
  pageSize,
}: {
  filters: LibraryFilters;
  view: 'grid' | 'table';
  total: number;
  pageSize: number;
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const href = (page: number) => {
    const params = new URLSearchParams();
    if (filters.type !== 'all') params.set('type', filters.type);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.q) params.set('q', filters.q);
    if (filters.sort !== 'updated') params.set('sort', filters.sort);
    if (page > 1) params.set('page', String(page));
    if (view === 'table') params.set('view', 'table');
    const query = params.toString();
    return (query ? `/library?${query}` : '/library') as `/library?${string}`;
  };

  const items = Array.from({ length: pages }, (_, index) => index + 1).filter(
    (page) =>
      page === 1 || page === pages || Math.abs(page - filters.page) <= 2,
  );

  return (
    <nav className="flex items-center justify-center gap-1.5 pt-2">
      {filters.page > 1 ? (
        <Link
          to={href(filters.page - 1)}
          className="focus-ring rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          Anterior
        </Link>
      ) : null}

      {items.map((page, index) => {
        const previous = items[index - 1];
        const gap = previous != null && page - previous > 1;
        return (
          <span key={page} className="flex items-center gap-1.5">
            {gap ? <span className="text-xs text-muted">…</span> : null}
            <Link
              to={href(page)}
              className={cn(
                'focus-ring grid size-8 place-items-center rounded-lg border text-xs',
                page === filters.page
                  ? 'border-accent/40 bg-accent/10 font-medium text-[#b9c8ff]'
                  : 'border-line bg-surface text-muted hover:text-ink',
              )}
            >
              {page}
            </Link>
          </span>
        );
      })}

      {filters.page < pages ? (
        <Link
          to={href(filters.page + 1)}
          className="focus-ring rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-ink"
        >
          Siguiente
        </Link>
      ) : null}
    </nav>
  );
};

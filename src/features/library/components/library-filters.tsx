'use client';

import { type FormEvent, useState } from 'react';
import { Link, useRouter } from 'waku';
import { GridIcon, ListIcon, SearchIcon } from '../../../components/ui/icons';
import { Input, Select } from '../../../components/ui/input';
import { cn } from '../../../lib/cn';
import { STATUS_META } from '../../series/schema';
import type { LibraryStats } from '../queries';
import type { LibraryFilters } from '../schema';

const STATUS_ORDER = [
  'planning',
  'in_progress',
  'completed',
  'paused',
  'dropped',
] as const;

const buildQuery = (
  filters: LibraryFilters,
  view: 'grid' | 'table',
  overrides: Partial<LibraryFilters> = {},
) => {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.type !== 'all') params.set('type', next.type);
  if (next.status !== 'all') params.set('status', next.status);
  if (next.q) params.set('q', next.q);
  if (next.sort !== 'updated') params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  if (view === 'table') params.set('view', 'table');
  const query = params.toString();
  return (query ? `/library?${query}` : '/library') as `/library?${string}`;
};

export const LibraryFiltersBar = ({
  filters,
  view,
  stats,
}: {
  filters: LibraryFilters;
  view: 'grid' | 'table';
  stats: LibraryStats;
}) => {
  const router = useRouter();
  const [term, setTerm] = useState(filters.q);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    router.push(buildQuery(filters, view, { q: term.trim(), page: 1 }));
  };

  const navigate = (overrides: Partial<LibraryFilters>) => {
    router.push(buildQuery(filters, view, { ...overrides, page: 1 }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form onSubmit={submit} className="relative w-full lg:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Filtrar por título…"
            className="h-9 pl-9"
            aria-label="Filtrar por título"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Select
            value={filters.type}
            onChange={(event) =>
              navigate({ type: event.target.value as LibraryFilters['type'] })
            }
            className="h-9 w-auto min-w-[110px]"
            aria-label="Tipo"
          >
            <option value="all">Todo</option>
            <option value="manga">Manga</option>
            <option value="anime">Anime</option>
          </Select>

          <Select
            value={filters.sort}
            onChange={(event) =>
              navigate({ sort: event.target.value as LibraryFilters['sort'] })
            }
            className="h-9 w-auto min-w-[140px]"
            aria-label="Ordenar"
          >
            <option value="updated">Recientes</option>
            <option value="title">Título A-Z</option>
            <option value="score">Mejor nota</option>
            <option value="progress">Más avanzado</option>
          </Select>

          <div className="flex items-center rounded-lg border border-line bg-surface p-0.5">
            <Link
              to={buildQuery(filters, 'grid')}
              className={cn(
                'focus-ring grid size-8 place-items-center rounded-md transition-colors',
                view === 'grid'
                  ? 'bg-surface-raised text-ink'
                  : 'text-muted hover:text-ink',
              )}
              aria-label="Vista de cuadrícula"
            >
              <GridIcon className="size-4" />
            </Link>
            <Link
              to={buildQuery(filters, 'table')}
              className={cn(
                'focus-ring grid size-8 place-items-center rounded-md transition-colors',
                view === 'table'
                  ? 'bg-surface-raised text-ink'
                  : 'text-muted hover:text-ink',
              )}
              aria-label="Vista de tabla"
            >
              <ListIcon className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => navigate({ status: 'all' })}
          className={cn(
            'focus-ring rounded-full border px-3 py-1 text-xs transition-colors',
            filters.status === 'all'
              ? 'border-accent/40 bg-accent/10 text-[#b9c8ff]'
              : 'border-line bg-surface text-muted hover:text-ink',
          )}
        >
          Todo
          <span className="ml-1.5 text-[10px] opacity-70">{stats.total}</span>
        </button>

        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status];
          const active = filters.status === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => navigate({ status })}
              className={cn(
                'focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                active
                  ? 'border-accent/40 bg-accent/10 text-[#b9c8ff]'
                  : 'border-line bg-surface text-muted hover:text-ink',
              )}
            >
              <span className={cn('size-1.5 rounded-full', meta.dot)} />
              {meta.short}
              <span className="text-[10px] opacity-70">
                {stats.byStatus[status]}
              </span>
            </button>
          );
        })}

        {filters.q ? (
          <button
            type="button"
            onClick={() => {
              setTerm('');
              navigate({ q: '' });
            }}
            className="focus-ring rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted hover:text-ink"
          >
            Limpiar búsqueda
          </button>
        ) : null}
      </div>
    </div>
  );
};

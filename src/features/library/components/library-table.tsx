import { Link } from 'waku';
import { StatusBadge, TypeBadge } from '../../../components/ui/badge';
import { Cover } from '../../../components/ui/cover';
import { StarIcon } from '../../../components/ui/icons';
import { ProgressBar } from '../../../components/ui/progress';
import { formatDate } from '../../../lib/text';
import type { LibraryItem } from '../queries';
import type { LibraryFilters } from '../schema';

export const LibraryTable = ({
  items,
  filters,
  view,
}: {
  items: LibraryItem[];
  filters: LibraryFilters;
  view: 'grid' | 'table';
}) => {
  const sortLink = (sort: LibraryFilters['sort']) => {
    const params = new URLSearchParams();
    if (filters.type !== 'all') params.set('type', filters.type);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.q) params.set('q', filters.q);
    if (sort !== 'updated') params.set('sort', sort);
    if (view === 'table') params.set('view', 'table');
    const query = params.toString();
    return (query ? `/library?${query}` : '/library') as `/library?${string}`;
  };

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-line/80 text-[11px] uppercase tracking-[0.08em] text-muted">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Progreso</th>
              <th className="px-4 py-3 font-medium">
                <Link to={sortLink('score')} className="hover:text-ink">
                  Nota
                </Link>
              </th>
              <th className="px-4 py-3 font-medium">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/50">
            {items.map((item) => (
              <tr
                key={item.entryId}
                className="group transition-colors hover:bg-surface-raised/50"
              >
                <td className="px-4 py-2.5">
                  <Link
                    to={`/series/${item.seriesId}`}
                    className="focus-ring flex items-center gap-3 rounded"
                  >
                    <div className="w-8 shrink-0">
                      <Cover
                        src={item.coverImage}
                        title={item.title}
                        type={item.type}
                        sizes="36px"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink group-hover:text-white">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-muted">
                        {item.year ?? '—'}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <TypeBadge type={item.type} />
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={item.status} type={item.type} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="w-32">
                    <p className="mb-1 text-[11px] text-muted">
                      {item.progress}
                      {item.totalUnits ? ` / ${item.totalUnits}` : ''}
                    </p>
                    <ProgressBar value={item.progress} max={item.totalUnits} />
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {item.score !== null ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber">
                      <StarIcon className="size-3.5" filled />
                      {item.score}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted">
                  {formatDate(item.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

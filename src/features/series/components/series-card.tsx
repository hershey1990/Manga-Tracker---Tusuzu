import { Link } from 'waku';
import { StatusBadge } from '../../../components/ui/badge';
import { Cover } from '../../../components/ui/cover';
import { ProgressBar } from '../../../components/ui/progress';
import type { LibraryItem } from '../../library/queries';
import { unitName } from '../schema';

export const SeriesCard = ({ item }: { item: LibraryItem }) => {
  const units = item.totalUnits ?? item.progress;
  return (
    <Link
      to={`/series/${item.seriesId}`}
      className="focus-ring group flex flex-col gap-2.5 rounded-xl"
    >
      <div className="relative overflow-hidden rounded-xl transition-transform duration-300 group-hover:-translate-y-1">
        <Cover src={item.coverImage} title={item.title} type={item.type} />
        <div className="absolute left-2 top-2">
          <StatusBadge
            status={item.status}
            type={item.type}
            className="bg-void/80 backdrop-blur"
          />
        </div>
        {item.score !== null ? (
          <span className="absolute right-2 top-2 rounded-md bg-void/80 px-1.5 py-0.5 text-[11px] font-semibold text-amber backdrop-blur">
            {item.score}/10
          </span>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink transition-colors group-hover:text-white">
          {item.title}
        </p>
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>
            {item.progress}
            {item.totalUnits ? ` / ${item.totalUnits}` : ''}{' '}
            {unitName(item.type, units)}
          </span>
          {item.year ? <span>{item.year}</span> : null}
        </div>
        <ProgressBar value={item.progress} max={item.totalUnits} />
      </div>
    </Link>
  );
};

export const QueueRow = ({ item }: { item: LibraryItem }) => (
  <Link
    to={`/series/${item.seriesId}`}
    className="focus-ring group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-raised"
  >
    <div className="w-9 shrink-0">
      <Cover
        src={item.coverImage}
        title={item.title}
        type={item.type}
        sizes="40px"
      />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-medium text-ink group-hover:text-white">
        {item.title}
      </p>
      <p className="text-[11px] text-muted">
        {item.progress}
        {item.totalUnits ? ` / ${item.totalUnits}` : ''}{' '}
        {unitName(item.type, item.totalUnits ?? item.progress)}
      </p>
    </div>
    <StatusBadge
      status={item.status}
      type={item.type}
      className="hidden sm:inline-flex"
    />
  </Link>
);

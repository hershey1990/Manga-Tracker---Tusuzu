import {
  type LibraryStatus,
  type SeriesType,
  STATUS_META,
} from '../../features/series/schema';
import { cn } from '../../lib/cn';

export const StatusBadge = ({
  status,
  type,
  className,
}: {
  status: LibraryStatus;
  type: SeriesType;
  className?: string;
}) => {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        meta.tone,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label(type)}
    </span>
  );
};

export const TypeBadge = ({
  type,
  className,
}: {
  type: SeriesType;
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted',
      className,
    )}
  >
    {type === 'anime' ? 'Anime' : 'Manga'}
  </span>
);

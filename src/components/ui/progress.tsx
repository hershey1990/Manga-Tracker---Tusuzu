import { cn } from '../../lib/cn';

export const ProgressBar = ({
  value,
  max,
  className,
}: {
  value: number;
  max: number | null;
  className?: string;
}) => {
  const percent =
    max && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-line',
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max ?? undefined}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          percent >= 100 ? 'bg-mint' : 'bg-accent',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

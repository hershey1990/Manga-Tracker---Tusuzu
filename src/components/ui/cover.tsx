import type { ComponentProps } from 'react';
import type { SeriesType } from '../../features/series/schema';
import { cn } from '../../lib/cn';

const TONES: Record<SeriesType, string> = {
  manga: 'from-[#1c2340] via-[#161a28] to-[#0e1017]',
  anime: 'from-[#1b2f2b] via-[#141d22] to-[#0e1017]',
};

export const Cover = ({
  src,
  title,
  type,
  className,
  sizes = '200px',
}: {
  src: string | null;
  title: string;
  type: SeriesType;
  className?: string;
  sizes?: string;
}) => {
  const compact = title.replace(/[^\p{L}\p{N}]/gu, '');
  const initials = compact.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-line/80 bg-gradient-to-br',
        TONES[type],
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={`Portada de ${title}`}
          loading="lazy"
          sizes={sizes}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center">
          <span className="text-2xl font-bold tracking-tight text-white/25">
            {initials || '?'}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/15">
            {type}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-transparent" />
    </div>
  );
};

export const Avatar = ({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null | undefined;
  className?: string;
}) => {
  const words = name.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  const initials = words
    .slice(0, 2)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      className={cn(
        'grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-raised text-xs font-semibold text-ink',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        initials || '?'
      )}
    </div>
  );
};

export const Surface = ({ className, ...props }: ComponentProps<'div'>) => (
  <div className={cn('panel', className)} {...props} />
);

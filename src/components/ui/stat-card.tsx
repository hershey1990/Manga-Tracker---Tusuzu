import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const TONES = {
  accent: 'text-accent bg-accent/10 border-accent/20',
  mint: 'text-mint bg-mint/10 border-mint/20',
  amber: 'text-amber bg-amber/10 border-amber/20',
  rose: 'text-rose bg-rose/10 border-rose/20',
  muted: 'text-muted bg-surface-raised border-line',
} as const;

export const StatCard = ({
  label,
  value,
  detail,
  icon,
  tone = 'muted',
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
  tone?: keyof typeof TONES;
}) => (
  <div className="panel flex flex-col gap-3 p-4">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {icon ? (
        <span
          className={cn(
            'grid size-7 place-items-center rounded-md border',
            TONES[tone],
          )}
        >
          {icon}
        </span>
      ) : null}
    </div>
    <div>
      <p className="text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-xs text-muted">{detail}</p> : null}
    </div>
  </div>
);

export const SectionHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => (
  <div className="flex items-end justify-between gap-4">
    <div>
      <h2 className="text-base font-semibold tracking-tight text-white">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      ) : null}
    </div>
    {action}
  </div>
);

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'panel flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
      className,
    )}
  >
    {icon ? (
      <span className="grid size-11 place-items-center rounded-xl border border-line bg-surface-raised text-accent">
        {icon}
      </span>
    ) : null}
    <div className="space-y-1">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
    </div>
    {action}
  </div>
);

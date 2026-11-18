import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Input = ({ className, ...props }: ComponentProps<'input'>) => (
  <input
    className={cn(
      'focus-ring h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/60',
      'transition-colors hover:border-[#2f364a] focus:border-accent/60',
      className,
    )}
    {...props}
  />
);

export const Textarea = ({
  className,
  ...props
}: ComponentProps<'textarea'>) => (
  <textarea
    className={cn(
      'focus-ring w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60',
      'transition-colors hover:border-[#2f364a] focus:border-accent/60',
      className,
    )}
    {...props}
  />
);

export const Select = ({ className, ...props }: ComponentProps<'select'>) => (
  <select
    className={cn(
      'focus-ring h-10 w-full appearance-none rounded-lg border border-line bg-surface px-3 text-sm text-ink',
      'transition-colors hover:border-[#2f364a] focus:border-accent/60',
      className,
    )}
    {...props}
  />
);

export const Field = ({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <label
      htmlFor={htmlFor}
      className="block text-xs font-medium uppercase tracking-[0.08em] text-muted"
    >
      {label}
    </label>
    {children}
    {hint ? <p className="text-xs text-muted/80">{hint}</p> : null}
  </div>
);

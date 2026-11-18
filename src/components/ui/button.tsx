import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-void font-semibold hover:bg-[#87a1ff] active:bg-accent-strong',
  secondary:
    'border border-line bg-surface-raised text-ink hover:border-[#323a52] hover:bg-surface-hover',
  ghost: 'text-muted hover:bg-surface-raised hover:text-ink',
  danger: 'border border-rose/30 bg-rose/10 text-[#f49bb2] hover:bg-rose/20',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  icon: 'h-9 w-9 justify-center',
};

export type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant;
  size?: Size;
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={cn(
      'focus-ring inline-flex select-none items-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      VARIANTS[variant],
      SIZES[size],
      className,
    )}
    {...props}
  />
);

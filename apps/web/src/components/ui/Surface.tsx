import type { HTMLAttributes, ReactNode } from 'react';

type SurfaceVariant = 'default' | 'muted' | 'inset' | 'glass';

const variantClass: Record<SurfaceVariant, string> = {
  default:
    'border border-white/[0.08] bg-app-surface/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] shadow-app-soft backdrop-blur-lg supports-[backdrop-filter]:bg-app-surface/58',
  muted:
    'border border-white/[0.05] bg-app-bg-subtle/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] shadow-none backdrop-blur-md',
  inset:
    'border border-white/[0.06] bg-app-bg/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md',
  glass:
    'border border-white/10 bg-app-bg/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] shadow-app-lift backdrop-blur-2xl supports-[backdrop-filter]:bg-app-bg/32',
};

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: SurfaceVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClass = {
  none: '',
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-6 md:p-8',
} as const;

export function Surface({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  ...rest
}: SurfaceProps) {
  return (
    <div
      className={`relative rounded-app-xl transition-[box-shadow,border-color,transform,background-color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] motion-reduce:transition-shadow motion-reduce:duration-200 ${variantClass[variant]} ${paddingClass[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

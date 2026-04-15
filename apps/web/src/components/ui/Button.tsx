import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'border border-white/10 bg-gradient-to-br from-app-accent via-violet-500 to-app-accent-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_32px_-8px_rgba(147,124,248,0.55),0_2px_12px_-4px_rgba(45,212,191,0.18)] hover:-translate-y-0.5 hover:brightness-[1.06] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_10px_44px_-8px_rgba(147,124,248,0.58),0_0_28px_-6px_rgba(147,124,248,0.35)] active:translate-y-0 active:brightness-[0.98] motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0',
  secondary:
    'border border-white/[0.09] bg-app-elevated/80 text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] shadow-app-soft backdrop-blur-md hover:-translate-y-0.5 hover:border-app-border-strong hover:bg-app-surface-hover/95 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_36px_-12px_rgba(0,0,0,0.35)] active:translate-y-0 motion-reduce:hover:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0',
  ghost:
    'border border-transparent bg-transparent text-app-muted shadow-none hover:-translate-y-px hover:bg-white/[0.06] hover:text-app-text hover:shadow-[0_0_24px_-12px_rgba(147,124,248,0.2)] active:translate-y-0 motion-reduce:hover:translate-y-0 disabled:opacity-50',
  danger:
    'border border-red-400/25 bg-red-500/[0.12] text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] shadow-app-soft hover:-translate-y-0.5 hover:border-red-400/35 hover:bg-red-500/22 hover:shadow-[0_8px_32px_-10px_rgba(239,68,68,0.25)] active:translate-y-0 motion-reduce:hover:translate-y-0 disabled:opacity-50',
  outline:
    'border border-app-border/95 bg-transparent text-app-text shadow-none hover:-translate-y-0.5 hover:border-app-accent/50 hover:bg-app-accent-muted/80 hover:shadow-[0_0_0_1px_rgba(147,124,248,0.12),0_8px_32px_-14px_rgba(147,124,248,0.22)] active:translate-y-0 motion-reduce:hover:translate-y-0 disabled:opacity-50',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  children,
  className = '',
  variant = 'secondary',
  leftIcon,
  rightIcon,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-app-md px-4 py-2.5 text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,color,filter,opacity] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] motion-reduce:transition-colors motion-reduce:duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-gradient-to-br from-app-accent to-cyan-500 text-white shadow-[0_4px_28px_-6px_rgba(147,124,248,0.55),0_2px_8px_-2px_rgba(45,212,191,0.2)] hover:brightness-110 hover:shadow-[0_8px_36px_-6px_rgba(147,124,248,0.5)] active:brightness-95 disabled:opacity-50',
  secondary:
    'border-app-border/90 bg-app-elevated/90 text-app-text shadow-app-soft backdrop-blur-sm hover:border-app-border-strong hover:bg-app-surface-hover disabled:opacity-50',
  ghost:
    'border-transparent bg-transparent text-app-muted hover:bg-app-surface/80 hover:text-app-text disabled:opacity-50',
  danger:
    'border-red-500/35 bg-red-500/12 text-red-300 shadow-app-soft hover:bg-red-500/22 disabled:opacity-50',
  outline:
    'border-app-border bg-transparent text-app-text shadow-none hover:border-app-accent/45 hover:bg-app-accent-muted hover:shadow-app-soft disabled:opacity-50',
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
      className={`inline-flex items-center justify-center gap-2 rounded-app-md border px-4 py-2.5 text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,color,filter] duration-200 active:scale-[0.98] disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

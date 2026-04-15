import type { ReactNode } from 'react';

interface SlotProps {
  className?: string;
  name?: string;
  children?: ReactNode;
}

/**
 * Empty placeholder region with optional size/layout classes.
 * Displays component name when provided for wireframe identification.
 */
export default function Slot({ className = '', name, children = null }: SlotProps) {
  return (
    <div
      className={`group flex min-h-[4.5rem] flex-col items-center justify-center rounded-app-lg border border-dashed border-white/[0.12] bg-gradient-to-b from-app-surface/55 to-app-bg-subtle/40 px-3 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,background-color,box-shadow] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] motion-reduce:transition-colors hover:border-app-accent/30 hover:from-app-surface/70 hover:to-app-accent-muted/10 hover:shadow-[0_0_32px_-14px_rgba(147,124,248,0.2)] ${className}`}
      aria-hidden
    >
      {name && (
        <span className="select-none text-[11px] font-semibold uppercase tracking-[0.14em] text-app-faint transition-colors duration-[var(--duration-app)] ease-[var(--ease-app-out)] group-hover:text-app-muted">
          {name}
        </span>
      )}
      {children}
    </div>
  );
}

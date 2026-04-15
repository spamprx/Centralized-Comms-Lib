import type { ReactNode } from 'react';

export interface PageShellProps {
  children: ReactNode;
  /** Wider layouts (e.g. analytics grids) */
  wide?: boolean;
  className?: string;
}

export function PageShell({ children, wide = false, className = '' }: PageShellProps) {
  return (
    <div
      className={`relative z-[1] mx-auto min-h-0 w-full px-app-page py-app-page pb-28 transition-[max-width,padding] duration-[var(--duration-app-slow)] ease-[var(--ease-app-material)] motion-reduce:transition-none md:px-app-page-lg md:pb-app-page-lg ${wide ? 'max-w-[1680px]' : 'max-w-6xl'} ${className}`}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(42rem,92%)] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
        aria-hidden
      />
      {children}
    </div>
  );
}

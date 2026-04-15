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
      className={`relative z-[1] mx-auto min-h-0 w-full px-app-page py-app-page pb-28 md:px-app-page-lg md:pb-app-page-lg ${wide ? 'max-w-[1680px]' : 'max-w-6xl'} ${className}`}
    >
      {children}
    </div>
  );
}

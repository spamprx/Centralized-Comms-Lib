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
      className={`flex flex-col items-center justify-center rounded-app-md border border-dashed border-app-border bg-app-surface/50 text-center ${className}`}
      aria-hidden
    >
      {name && <span className="select-none text-xs font-medium text-app-faint">{name}</span>}
      {children}
    </div>
  );
}

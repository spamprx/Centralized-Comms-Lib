import type { ReactNode } from "react";

interface SlotProps {
  className?: string;
  name?: string;
  children?: ReactNode;
}

/**
 * Empty placeholder region with optional size/layout classes.
 * Displays component name when provided for wireframe identification.
 */
export default function Slot({ className = "", name, children = null }: SlotProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded border border-dashed border-gray-600 bg-gray-800/30 text-center ${className}`}
      aria-hidden
    >
      {name && (
        <span className="text-xs font-medium text-gray-500 select-none">
          {name}
        </span>
      )}
      {children}
    </div>
  );
}

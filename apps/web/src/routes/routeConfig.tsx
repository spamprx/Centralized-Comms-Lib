import type { ReactNode } from 'react';

/**
 * Route definition for a single path.
 */
export interface RouteEntry {
  path: string;
  element: ReactNode;
}

/**
 * Group of routes under a logical section (for organization only).
 */
export interface RouteGroup {
  label: string;
  routes: RouteEntry[];
}

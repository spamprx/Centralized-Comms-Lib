/**
 * Shared form field classes aligned with the app design system.
 */
export const formLabelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-app-muted";

export const formInputClass =
  "w-full rounded-app-md border border-app-border bg-app-surface px-3 py-2.5 text-sm text-app-text shadow-app-soft transition-[border-color,box-shadow] duration-200 placeholder:text-app-faint hover:border-app-border-strong focus:border-app-accent/50 focus:shadow-[var(--shadow-app-glow)] disabled:cursor-not-allowed disabled:opacity-60";

export const formSelectClass = `${formInputClass} cursor-pointer`;

export const formTextareaClass = `${formInputClass} resize-y min-h-[6rem]`;

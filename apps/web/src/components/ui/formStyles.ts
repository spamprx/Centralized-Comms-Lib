/**
 * Shared form field classes aligned with the app design system.
 */
export const formLabelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-app-muted transition-colors duration-[var(--duration-app)] ease-[var(--ease-app-out)] motion-reduce:transition-none';

export const formInputClass =
  'w-full rounded-app-md border border-white/[0.1] bg-app-surface/90 px-3 py-2.5 text-sm text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] shadow-app-soft backdrop-blur-sm transition-[border-color,box-shadow,background-color,transform,color] duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] placeholder:text-app-faint placeholder:transition-opacity motion-reduce:transition-colors motion-reduce:duration-200 hover:border-app-border-strong hover:bg-app-surface focus:border-app-accent/55 focus:bg-app-bg-subtle/80 focus:shadow-[var(--shadow-app-glow),inset_0_0_0_1px_rgba(147,124,248,0.08)] focus-visible:border-app-accent/55 focus-visible:shadow-[var(--shadow-app-glow)] disabled:cursor-not-allowed disabled:opacity-60';

export const formSelectClass = `${formInputClass} cursor-pointer`;

export const formTextareaClass = `${formInputClass} resize-y min-h-[6rem]`;

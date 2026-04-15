import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  hint?: string;
  actions?: ReactNode;
  className?: string;
  /** Accent word in title (first match gets gradient) */
  accentWord?: string;
}

export function PageHeader({
  title,
  description,
  hint,
  actions,
  className = '',
  accentWord,
}: PageHeaderProps) {
  const renderTitle = () => {
    if (accentWord && title.includes(accentWord)) {
      const [before, ...rest] = title.split(accentWord);
      const after = rest.join(accentWord);
      return (
        <>
          {before}
          <span className="app-text-gradient">{accentWord}</span>
          {after}
        </>
      );
    }
    return title;
  };

  return (
    <header
      className={`group relative mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div
        className="pointer-events-none absolute -left-3 top-1 hidden h-[2.85rem] w-[3px] rounded-full bg-gradient-to-b from-app-accent via-app-accent-hover to-app-accent-2 opacity-95 shadow-[0_0_18px_rgba(147,124,248,0.45)] sm:block"
        aria-hidden
      />
      <div className="min-w-0 pl-0 sm:pl-4 animate-fade-in">
        <h1 className="m-0 text-2xl font-bold tracking-tight text-app-text transition-colors duration-[var(--duration-app-slow)] ease-[var(--ease-app-out)] sm:text-3xl md:text-[2rem] md:leading-tight">
          {renderTitle()}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-app-muted transition-colors duration-[var(--duration-app)] ease-[var(--ease-app-out)] md:text-[15px]">
            {description}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-2.5 max-w-2xl border-l-[3px] border-app-accent/40 bg-app-accent-muted/15 py-1.5 pl-3.5 text-xs leading-relaxed text-app-faint transition-[border-color,background-color] duration-[var(--duration-app)] ease-[var(--ease-app-out)]">
            {hint}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 transition-opacity duration-[var(--duration-app)] ease-[var(--ease-app-out)] sm:justify-end sm:animate-fade-in">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

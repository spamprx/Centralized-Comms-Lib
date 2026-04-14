import type { ReactNode } from "react";

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
  className = "",
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
      className={`relative mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div
        className="pointer-events-none absolute -left-3 top-1 hidden h-[2.75rem] w-1 rounded-full bg-gradient-to-b from-app-accent via-cyan-400/80 to-transparent opacity-90 sm:block"
        aria-hidden
      />
      <div className="min-w-0 pl-0 sm:pl-4 animate-fade-in">
        <h1 className="m-0 text-2xl font-bold tracking-tight text-app-text sm:text-3xl md:text-[2rem] md:leading-tight">
          {renderTitle()}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-app-muted md:text-[15px]">
            {description}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-2.5 max-w-2xl border-l-2 border-app-accent/35 pl-3 text-xs leading-relaxed text-app-faint">
            {hint}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

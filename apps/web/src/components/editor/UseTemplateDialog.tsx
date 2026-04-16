import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import {
  templateCrudService,
  type TemplateRecord,
  type TemplateStatus,
} from '../../services/templateCrudService';

export type UseTemplateDialogProps = {
  onClose: () => void;
  /** Called with the full template row (includes layout payloads). */
  onSelectTemplate: (template: TemplateRecord) => void;
};

function statusLabel(s: TemplateStatus): string {
  if (s === 'ACTIVE') return 'Active';
  if (s === 'DRAFT') return 'Draft';
  return 'Archived';
}

/** Mount when visible; unmounting resets local state for the next open. */
export default function UseTemplateDialog({ onClose, onSelectTemplate }: UseTemplateDialogProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void templateCrudService
      .list({ status: 'ACTIVE' })
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load templates');
        setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const hay = `${t.name} ${t.slug} ${t.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, query]);

  const pick = useCallback(
    (t: TemplateRecord) => {
      onSelectTemplate(t);
      onClose();
    },
    [onClose, onSelectTemplate],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[min(520px,85vh)] w-full max-w-md flex-col overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/88 text-app-text shadow-app-lift backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/72"
        role="dialog"
        aria-labelledby="use-template-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/45 to-app-accent-2/35"
          aria-hidden
        />
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <h2
            id="use-template-title"
            className="m-0 text-[15px] font-semibold tracking-tight text-app-text"
          >
            Use template
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-app-md border border-transparent text-app-muted transition-colors hover:bg-white/8 hover:text-app-text"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="shrink-0 px-4 pb-2 pt-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-app-faint"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="box-border w-full rounded-app-md border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none placeholder:text-app-faint focus:border-app-accent/40 focus:ring-2 focus:ring-app-accent/15"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-app-muted">
              <Loader2 size={18} className="animate-spin" />
              Loading templates…
            </div>
          ) : error ? (
            <p className="px-2 py-4 text-[13px] text-red-400">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-app-faint">
              {templates.length === 0
                ? 'No active templates. Activate one on the Templates page to use it here.'
                : 'No templates match your search.'}
            </p>
          ) : (
            <ul className="m-0 list-none space-y-1 p-0">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => pick(t)}
                    className="flex w-full flex-col items-start gap-0.5 rounded-app-md border border-transparent px-3 py-2.5 text-left transition-colors hover:border-white/12 hover:bg-white/[0.04]"
                  >
                    <span className="text-[13px] font-medium text-app-text">{t.name}</span>
                    <span className="font-mono text-[11px] text-app-muted">{t.slug}</span>
                    {t.description ? (
                      <span className="line-clamp-2 text-[11px] leading-snug text-app-muted">
                        {t.description}
                      </span>
                    ) : null}
                    <span className="text-[10px] font-medium uppercase tracking-wide text-app-faint">
                      {statusLabel(t.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

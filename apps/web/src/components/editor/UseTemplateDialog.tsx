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
      .list({ status: 'ALL' })
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows.filter((t) => t.status !== 'ARCHIVED'));
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(520px,85vh)] w-full max-w-md flex-col rounded-[var(--editor-radius-card)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-card-bg)] text-[var(--editor-doc-text)]"
        role="dialog"
        aria-labelledby="use-template-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b-[0.5px] border-[var(--editor-border)] px-4 py-3">
          <h2 id="use-template-title" className="m-0 text-[15px] font-semibold">
            Use template
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--editor-radius-input)] border-[0.5px] border-transparent text-[var(--editor-muted)] hover:bg-[var(--editor-canvas-bg)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="shrink-0 px-4 pb-2 pt-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--editor-faint)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="box-border w-full rounded-[var(--editor-radius-input)] border-[0.5px] border-[var(--editor-border)] bg-[var(--editor-topbar-bg)] py-2 pl-8 pr-3 text-[13px] text-[var(--editor-doc-text)] outline-none placeholder:text-[var(--editor-faint)]"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-[var(--editor-muted)]">
              <Loader2 size={18} className="animate-spin" />
              Loading templates…
            </div>
          ) : error ? (
            <p className="px-2 py-4 text-[13px] text-red-600/90">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-[var(--editor-faint)]">
              {templates.length === 0 ? 'No templates available.' : 'No templates match your search.'}
            </p>
          ) : (
            <ul className="m-0 list-none space-y-1 p-0">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => pick(t)}
                    className="flex w-full flex-col items-start gap-0.5 rounded-[var(--editor-radius-input)] border-[0.5px] border-transparent px-3 py-2.5 text-left transition-colors hover:border-[var(--editor-border)] hover:bg-[var(--editor-canvas-bg)]"
                  >
                    <span className="text-[13px] font-medium text-[var(--editor-doc-text)]">{t.name}</span>
                    <span className="font-mono text-[11px] text-[var(--editor-muted)]">{t.slug}</span>
                    {t.description ? (
                      <span className="line-clamp-2 text-[11px] leading-snug text-[var(--editor-muted)]">
                        {t.description}
                      </span>
                    ) : null}
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--editor-faint)]">
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

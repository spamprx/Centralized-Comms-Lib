import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, X, Loader2, Copy } from 'lucide-react';
import { templateCrudService } from '../../services/templateCrudService';

const LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'en', name: 'English' },
] as const;

const DEFAULT_CAUTION =
  'This translation runs in your browser only and is not saved anywhere. To keep it in your work, paste the result into the editor (or edit your draft) and save. Formatting, images, and special blocks are not preserved — only plain text is sent for translation.';

export type TranslatePlainTextModalProps = {
  open: boolean;
  onClose: () => void;
  /** Modal heading — e.g. article title or "Content" */
  subjectLabel: string;
  /** Where this was opened from — e.g. "Library · reading view" */
  contextHint: string;
  /** What subset of text is being translated */
  sourceModeLabel: string;
  /** Plain text to send to the translation API */
  sourceText: string;
  /** Optional override for the yellow caution box */
  cautionText?: string;
};

export default function TranslatePlainTextModal({
  open,
  onClose,
  subjectLabel,
  contextHint,
  sourceModeLabel,
  sourceText,
  cautionText = DEFAULT_CAUTION,
}: TranslatePlainTextModalProps) {
  const [targetLocale, setTargetLocale] = useState<string>('es');
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTranslated(null);
    setError(null);
    setLoading(false);
  }, [open, sourceText]);

  const handleTranslate = async () => {
    const t = sourceText.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    setTranslated(null);
    try {
      const res = await templateCrudService.translateText(t, targetLocale);
      setTranslated(res.translated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const trimmed = sourceText.trim();

  const modal = (
    <div
      className="fixed inset-0 z-[1400] overflow-y-auto bg-black/65 p-4 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="translate-plaintext-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-app-border/90 bg-app-bg-subtle shadow-app-lift">
        <div className="flex items-center justify-between border-b border-app-border/60 px-5 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3
              id="translate-plaintext-title"
              className="m-0 truncate text-base font-semibold text-app-text sm:text-lg"
            >
              Translate
            </h3>
            <p className="m-0 mt-0.5 truncate text-[11px] text-app-faint sm:text-xs">
              {contextHint}
              {subjectLabel ? (
                <>
                  {' · '}
                  <span className="text-app-muted">{subjectLabel}</span>
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-app-faint hover:bg-app-surface-hover hover:text-app-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[min(78vh,640px)] overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/95 sm:text-xs">
            {cautionText}
          </div>

          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[140px] flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-app-faint">
                Target language
              </span>
              <select
                value={targetLocale}
                onChange={(e) => {
                  setTargetLocale(e.target.value);
                  setTranslated(null);
                  setError(null);
                }}
                className="rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm text-app-text outline-none focus:ring-2 focus:ring-app-accent/50"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name} ({lang.code})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleTranslate()}
              disabled={loading || !trimmed}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              {loading ? 'Translating…' : 'Translate'}
            </button>
          </div>

          <p className="mb-3 text-[11px] text-app-muted sm:text-xs">
            <span className="font-medium text-app-text">Source:</span> {sourceModeLabel}
            {!trimmed ? (
              <span className="ml-1 text-amber-200/90">(nothing to translate — select text or use full body)</span>
            ) : null}
          </p>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {translated ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-app-muted">Result</label>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(translated)}
                  className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-xs text-app-muted hover:bg-white/[0.06]"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <div className="rounded-lg border border-app-border/60 bg-black/20 p-4">
                <pre className="m-0 whitespace-pre-wrap font-mono text-sm text-app-text">{translated}</pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

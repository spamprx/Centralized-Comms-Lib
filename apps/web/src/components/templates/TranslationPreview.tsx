import { useState } from 'react';
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
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
];

interface TranslationPreviewProps {
  templateId: string;
  templateName: string;
  templateContent: string;
  onClose: () => void;
}

export default function TranslationPreview({
  templateName,
  templateContent,
  onClose,
}: TranslationPreviewProps) {
  const [targetLocale, setTargetLocale] = useState('es');
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTranslate() {
    if (!templateContent.trim()) return;
    setLoading(true);
    setError(null);
    setTranslated(null);
    try {
      const res = await templateCrudService.translateText(templateContent, targetLocale);
      setTranslated(res.translated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setLoading(false);
    }
  }

  if (!templateContent || templateContent.trim() === '') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
        <div className="w-full max-w-2xl rounded-xl border border-app-border/90 bg-app-bg-subtle p-6 shadow-app-lift">
          <div className="text-center">
            <Globe className="mx-auto mb-4 text-app-accent" size={40} />
            <h3 className="mb-2 text-lg font-semibold text-app-text">Translation Preview</h3>
            <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-4">
              <p className="font-medium text-amber-200">Template Content is Empty</p>
              <p className="mt-2 text-sm text-amber-200/70">
                Add template content first to translate it.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-6 rounded-lg bg-app-accent px-6 py-2 text-sm font-medium text-white hover:bg-app-accent/80"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-4xl rounded-xl border border-app-border/90 bg-app-bg-subtle shadow-app-lift">
        <div className="flex items-center justify-between border-b border-app-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <Globe className="text-app-accent" size={20} />
            <h3 className="text-lg font-semibold text-app-text">Translate</h3>
            <span className="text-sm text-app-faint">({templateName})</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-app-faint hover:bg-app-surface-hover hover:text-app-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-app-muted">Target language</span>
              <select
                value={targetLocale}
                onChange={(e) => {
                  setTargetLocale(e.target.value);
                  setTranslated(null);
                  setError(null);
                }}
                className="w-48 rounded-lg border border-app-border bg-app-bg-subtle px-3 py-2 text-sm text-app-text outline-none focus:ring-2 focus:ring-app-accent/50"
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
              onClick={handleTranslate}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              {loading ? 'Translating…' : 'Translate'}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {translated && (
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
                <pre className="whitespace-pre-wrap font-mono text-sm text-app-text">
                  {translated}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type TextBlockFormValues = {
  sectionTitle: string;
  editorPlaceholder: string;
};

export type MediaBlockFormValues = {
  role: 'hero' | 'inline' | 'gallery';
  alt: string;
  caption: string;
};

export type FieldBlockFormValues = {
  fieldKey: string;
  label: string;
  helpText: string;
  required: boolean;
};

const FIELD_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function ModalChrome({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4">
      <div
        className="w-full max-w-md rounded-app-xl border border-app-border/90 bg-app-bg-subtle/98 p-4 shadow-app-lift"
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-modal-title"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 id="block-modal-title" className="m-0 text-lg font-semibold text-app-text">
              {title}
            </h3>
            {description ? <p className="mt-1 mb-0 text-sm text-app-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-app-faint hover:bg-app-surface-hover hover:text-app-text"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="mt-4 flex justify-end gap-2 border-t border-app-border/60 pt-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

type TextModalProps = {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: Partial<TextBlockFormValues>;
  onClose: () => void;
  onSubmit: (values: TextBlockFormValues) => void;
};

export function TextBlockModal({ open, mode, initial, onClose, onSubmit }: TextModalProps) {
  const [sectionTitle, setSectionTitle] = useState('');
  const [editorPlaceholder, setEditorPlaceholder] = useState('');

  useEffect(() => {
    if (!open) return;
    setSectionTitle(initial?.sectionTitle ?? '');
    setEditorPlaceholder(initial?.editorPlaceholder ?? '');
  }, [open, initial?.sectionTitle, initial?.editorPlaceholder]);

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit({
      sectionTitle: sectionTitle.trim(),
      editorPlaceholder: editorPlaceholder.trim() || 'Write section content…',
    });
  };

  return (
    <ModalChrome
      title={mode === 'add' ? 'Add text block' : 'Configure text block'}
      description="Optional heading label for this section and placeholder copy for the editor."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-app-border px-3 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg border border-app-accent/50 bg-app-accent-muted px-3 py-2 text-sm text-app-text"
          >
            {mode === 'add' ? 'Add to canvas' : 'Save'}
          </button>
        </>
      }
    >
      <div>
        <label className="mb-1 block text-[12px] text-app-muted">Section title (optional)</label>
        <input
          value={sectionTitle}
          onChange={(e) => setSectionTitle(e.target.value)}
          placeholder="e.g. Introduction"
          className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm"
        />
        <p className="mt-1 mb-0 text-[11px] text-app-faint">
          Shown in the block header; not sent as content by itself.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-[12px] text-app-muted">Editor placeholder</label>
        <input
          value={editorPlaceholder}
          onChange={(e) => setEditorPlaceholder(e.target.value)}
          placeholder="Write section content…"
          className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm"
        />
      </div>
    </ModalChrome>
  );
}

type MediaModalProps = {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: Partial<MediaBlockFormValues>;
  onClose: () => void;
  onSubmit: (values: MediaBlockFormValues) => void;
};

export function MediaBlockModal({ open, mode, initial, onClose, onSubmit }: MediaModalProps) {
  const [role, setRole] = useState<MediaBlockFormValues['role']>('inline');
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRole(initial?.role ?? 'inline');
    setAlt(initial?.alt ?? '');
    setCaption(initial?.caption ?? '');
    setError(null);
  }, [open, initial?.role, initial?.alt, initial?.caption]);

  if (!open) return null;

  const handleSubmit = () => {
    const t = alt.trim();
    if (!t) {
      setError('Alt text helps accessibility — add a short description.');
      return;
    }
    setError(null);
    onSubmit({ role, alt: t, caption: caption.trim() });
  };

  return (
    <ModalChrome
      title={mode === 'add' ? 'Add media block' : 'Configure media block'}
      description="Define how this slot should behave and how it is described when assets are attached later."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-app-border px-3 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg border border-app-accent/50 bg-app-accent-muted px-3 py-2 text-sm text-app-text"
          >
            {mode === 'add' ? 'Add to canvas' : 'Save'}
          </button>
        </>
      }
    >
      {error ? (
        <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {error}
        </div>
      ) : null}
      <div>
        <label className="mb-1 block text-[12px] text-app-muted">Layout role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MediaBlockFormValues['role'])}
          className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm"
        >
          <option value="hero">Hero — large banner area</option>
          <option value="inline">Inline — within content flow</option>
          <option value="gallery">Gallery — grid or carousel</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[12px] text-app-muted">Alt text</label>
        <input
          value={alt}
          onChange={(e) => {
            setAlt(e.target.value);
            setError(null);
          }}
          placeholder="Describe the image for screen readers"
          className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-[12px] text-app-muted">Caption (optional)</label>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Visible caption under the media"
          className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm"
        />
      </div>
    </ModalChrome>
  );
}

type FieldModalProps = {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: Partial<FieldBlockFormValues>;
  onClose: () => void;
  onSubmit: (values: FieldBlockFormValues) => void;
};

export function FieldBlockModal({ open, mode, initial, onClose, onSubmit }: FieldModalProps) {
  const [fieldKey, setFieldKey] = useState('');
  const [label, setLabel] = useState('');
  const [helpText, setHelpText] = useState('');
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFieldKey(initial?.fieldKey ?? '');
    setLabel(initial?.label ?? '');
    setHelpText(initial?.helpText ?? '');
    setRequired(initial?.required ?? false);
    setError(null);
  }, [open, initial?.fieldKey, initial?.label, initial?.helpText, initial?.required]);

  if (!open) return null;

  const handleSubmit = () => {
    const key = fieldKey.trim();
    if (!key) {
      setError('Field key is required.');
      return;
    }
    if (!FIELD_KEY_PATTERN.test(key)) {
      setError('Use letters, numbers, underscore; start with a letter or _.');
      return;
    }
    setError(null);
    onSubmit({
      fieldKey: key,
      label: label.trim(),
      helpText: helpText.trim(),
      required,
    });
  };

  return (
    <ModalChrome
      title={mode === 'add' ? 'Add field block' : 'Configure field block'}
      description="Merge fields become placeholders like {{field_key}} when content is rendered."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-app-border px-3 py-2 text-sm text-app-muted hover:bg-app-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg border border-app-accent/50 bg-app-accent-muted px-3 py-2 text-sm text-app-text"
          >
            {mode === 'add' ? 'Add to canvas' : 'Save'}
          </button>
        </>
      }
    >
      {error ? (
        <div className="rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}
      <div>
        <label className="mb-1 block text-[12px] text-app-muted">Field key</label>
        <input
          value={fieldKey}
          onChange={(e) => {
            setFieldKey(e.target.value);
            setError(null);
          }}
          placeholder="title"
          className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 font-mono text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-[12px] text-app-muted">Label (optional)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Article title"
          className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-[12px] text-app-muted">Help text (optional)</label>
        <textarea
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
          rows={2}
          placeholder="Hint for authors filling this field"
          className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-app-muted">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="rounded border-app-border"
        />
        Required when publishing
      </label>
    </ModalChrome>
  );
}

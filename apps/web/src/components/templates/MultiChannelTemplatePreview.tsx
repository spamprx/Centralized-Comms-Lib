import { useEffect, useMemo, useRef, useState } from 'react';
import { escapeHtml, renderTemplate } from '../../utils/templateRender';

type Channel = 'email' | 'sms' | 'web';

const DEFAULT_TEMPLATE = `Hello {{name}},

Your order {{order_id}} is confirmed.

Track: {{tracking.url}}`;

const DEFAULT_DATA = {
  name: 'Ava',
  order_id: 'ORD-10492',
  tracking: { url: 'https://example.com/track/ORD-10492' },
  title: 'Order confirmation',
};

function highlightPlaceholdersToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (full) => {
    return `<span class="rounded bg-amber-500/15 text-amber-200 border border-amber-400/30 px-1 py-[1px]">${full}</span>`;
  });
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[11px] ${
        active ? 'border-app-accent/50 bg-app-accent-muted text-app-text' : 'border-app-border text-app-muted hover:bg-app-surface-hover'
      }`}
    >
      {children}
    </button>
  );
}

export default function MultiChannelTemplatePreview({
  template: templateProp,
  templateReadOnly = false,
}: {
  template?: string;
  templateReadOnly?: boolean;
}) {
  const [channel, setChannel] = useState<Channel>('email');
  const [template, setTemplate] = useState(templateProp ?? DEFAULT_TEMPLATE);
  const [dataText, setDataText] = useState(() => JSON.stringify(DEFAULT_DATA, null, 2));
  const [allowHtml, setAllowHtml] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (typeof templateProp === 'string') setTemplate(templateProp);
  }, [templateProp]);

  const parsedData = useMemo(() => {
    try {
      const obj = JSON.parse(dataText);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false as const, error: 'Data must be a JSON object.' };
      return { ok: true as const, value: obj as Record<string, unknown> };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid JSON.' };
    }
  }, [dataText]);

  const result = useMemo(() => {
    const data = parsedData.ok ? parsedData.value : {};
    return renderTemplate(template, data);
  }, [template, parsedData]);

  const smsLimit = 160;
  const smsCount = result.rendered.length;
  const smsOver = smsCount > smsLimit;
  const smsPreview = smsOver ? `${result.rendered.slice(0, smsLimit)}…` : result.rendered;

  const emailHtml = useMemo(() => {
    if (allowHtml) return result.rendered;
    return escapeHtml(result.rendered).replaceAll('\n', '<br/>');
  }, [allowHtml, result.rendered]);

  const webJson = useMemo(() => {
    const title =
      (parsedData.ok ? parsedData.value.title : undefined) ??
      (parsedData.ok ? parsedData.value.subject : undefined) ??
      'Preview';
    return {
      title: typeof title === 'string' ? title : 'Preview',
      message: result.rendered,
      missingPlaceholders: result.missing,
    };
  }, [parsedData, result.rendered, result.missing]);

  function syncScroll() {
    const ta = textareaRef.current;
    const hl = highlightRef.current;
    if (!ta || !hl) return;
    hl.scrollTop = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-app-text">Multi-channel preview</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-app-border p-1 bg-black/10">
            <TabButton active={channel === 'email'} onClick={() => setChannel('email')}>
              Email
            </TabButton>
            <TabButton active={channel === 'sms'} onClick={() => setChannel('sms')}>
              SMS
            </TabButton>
            <TabButton active={channel === 'web'} onClick={() => setChannel('web')}>
              Web
            </TabButton>
          </div>
          {channel === 'email' ? (
            <label className="flex items-center gap-2 text-[11px] text-app-muted select-none">
              <input
                type="checkbox"
                checked={allowHtml}
                onChange={(e) => setAllowHtml(e.target.checked)}
                className="accent-amber-400"
              />
              Allow HTML
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="text-[12px] text-app-muted">{templateReadOnly ? 'Template (from layout canvas)' : 'Template editor'}</div>

          {templateReadOnly ? (
            <pre
              className="rounded-lg border border-app-border bg-app-bg-subtle p-3 font-mono text-sm leading-5 whitespace-pre-wrap break-words text-app-text max-h-56 overflow-auto"
              dangerouslySetInnerHTML={{ __html: highlightPlaceholdersToHtml(template) + '\n' }}
            />
          ) : (
            <div className="relative rounded-lg border border-app-border bg-app-bg-subtle overflow-hidden">
              <pre
                ref={highlightRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 m-0 p-3 font-mono text-sm leading-5 whitespace-pre-wrap break-words text-app-muted"
                dangerouslySetInnerHTML={{ __html: highlightPlaceholdersToHtml(template) + '\n' }}
              />
              <textarea
                ref={textareaRef}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                onScroll={syncScroll}
                className="relative w-full h-44 resize-y bg-transparent p-3 font-mono text-sm leading-5 outline-none text-transparent caret-app-text selection:bg-app-accent/25"
                placeholder="Type your template with {{placeholders}}..."
                spellCheck={false}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-app-faint">
              Placeholders: {result.placeholders.length ? result.placeholders.join(', ') : '—'}
            </div>
            {result.missing.length ? (
              <div className="text-[11px] text-amber-200">
                Missing: {result.missing.join(', ')}
              </div>
            ) : (
              <div className="text-[11px] text-emerald-200">All placeholders resolved</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[12px] text-app-muted">Example data (JSON)</div>
          <textarea
            value={dataText}
            onChange={(e) => setDataText(e.target.value)}
            className="w-full h-44 resize-y rounded-lg border border-app-border bg-app-bg-subtle p-3 font-mono text-xs text-app-text outline-none"
            spellCheck={false}
          />
          {!parsedData.ok ? (
            <div className="rounded-md border border-red-400/35 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
              {parsedData.error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-app-border bg-black/10 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[12px] text-app-muted">Live preview</div>
          {channel === 'sms' ? (
            <div className={`text-[11px] ${smsOver ? 'text-amber-200' : 'text-app-faint'}`}>
              {smsCount}/{smsLimit}
            </div>
          ) : null}
        </div>

        {channel === 'email' ? (
          <div className="rounded-md border border-app-border/70 bg-black/20 p-3">
            <div className="mb-2 text-[11px] text-app-faint">Email preview</div>
            <div
              className="prose prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: emailHtml }}
            />
            {!allowHtml ? (
              <p className="mt-2 mb-0 text-[11px] text-app-faint">
                HTML is escaped by default. Enable “Allow HTML” only for trusted content.
              </p>
            ) : null}
          </div>
        ) : null}

        {channel === 'sms' ? (
          <div className="rounded-md border border-app-border/70 bg-black/20 p-3">
            <div className="mb-2 text-[11px] text-app-faint">SMS preview</div>
            <pre className="whitespace-pre-wrap text-sm text-app-text m-0">{smsPreview || '—'}</pre>
            {smsOver ? (
              <p className="mt-2 mb-0 text-[11px] text-amber-200">
                Over 160 characters — preview trimmed.
              </p>
            ) : null}
          </div>
        ) : null}

        {channel === 'web' ? (
          <div className="rounded-md border border-app-border/70 bg-black/20 p-3">
            <div className="mb-2 text-[11px] text-app-faint">Web JSON preview</div>
            <pre className="m-0 overflow-auto text-[11px] text-app-text">
              {JSON.stringify(webJson, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}


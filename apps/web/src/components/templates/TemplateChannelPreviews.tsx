import { useMemo } from 'react';
import type { TemplateLayoutRegion } from '../../services/templateCrudService';
import { TemplateLayoutLivePreview, parseTemplateLayout, REGION_TYPES } from './TemplateLayoutEditor';

type BindingView = {
  id: string;
  channelId: string;
  channelKey: string;
  channelName: string;
  layoutConfig: unknown;
};

type TemplateChannelPreviewsProps = {
  /** Prefer active layout; fall back to draft layout. */
  layout: unknown;
  bindings: BindingView[];
};

function ensureString(x: unknown): string {
  return typeof x === 'string' ? x : '';
}

function regionPlainText(region: TemplateLayoutRegion): string {
  if (region.type === REGION_TYPES.field) {
    const k = ensureString((region.props as { fieldKey?: unknown } | undefined)?.fieldKey) || 'field';
    return `{{${k}}}`;
  }
  if (region.type === REGION_TYPES.media) {
    const caption = ensureString((region.props as { caption?: unknown } | undefined)?.caption).trim();
    const alt = ensureString((region.props as { alt?: unknown } | undefined)?.alt).trim();
    const label = caption || alt || 'image';
    return `[${label}]`;
  }
  if (region.type !== REGION_TYPES.richText) return '';

  const doc = (region.props as { doc?: any } | undefined)?.doc;
  if (!doc || typeof doc !== 'object') return '';

  const out: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    if (node.type === 'text' && typeof node.text === 'string') out.push(node.text);
    else if (node.type === 'hardBreak') out.push('\n');
    if (Array.isArray(node.content)) walk(node.content);
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') out.push('\n');
  };

  walk(doc);
  return out
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderModeFor(binding: BindingView): 'sms' | 'email' | 'app' {
  const key = (binding.channelKey ?? '').toLowerCase();
  const cfg = (binding.layoutConfig ?? {}) as any;
  const forced = typeof cfg?.renderAs === 'string' ? String(cfg.renderAs).toLowerCase() : '';
  if (forced === 'sms' || forced === 'email' || forced === 'app') return forced;
  if (key === 'email') return 'email';
  if (key === 'sms') return 'sms';
  return 'app';
}

function breakpointFor(binding: BindingView): 'desktop' | 'mobile' {
  const key = (binding.channelKey ?? '').toLowerCase();
  if (key === 'mobile') return 'mobile';
  return 'desktop';
}

function previewBreakpointsFor(binding: BindingView): Array<'desktop' | 'mobile'> {
  const key = (binding.channelKey ?? '').toLowerCase();
  const cfg = (binding.layoutConfig ?? {}) as any;
  const responsive =
    key === 'web' ||
    key === 'app' ||
    cfg?.layout === 'responsive' ||
    cfg?.responsive === true ||
    cfg?.breakpoints === 'responsive';

  const primary = breakpointFor(binding);
  if (!responsive) return [primary];
  return ['desktop', 'mobile'];
}

function clipText(text: string, maxChars: number | null): { text: string; clipped: boolean } {
  if (!maxChars || maxChars <= 0) return { text, clipped: false };
  if (text.length <= maxChars) return { text, clipped: false };
  return { text: `${text.slice(0, maxChars)}…`, clipped: true };
}

export default function TemplateChannelPreviews({ layout, bindings }: TemplateChannelPreviewsProps) {
  const regions = useMemo(() => parseTemplateLayout(layout)?.regions ?? [], [layout]);

  if (bindings.length === 0) {
    return <p className="text-xs text-app-faint m-0">No channels bound yet — add a binding to preview per-channel rendering.</p>;
  }

  if (regions.length === 0) {
    return <p className="text-xs text-app-faint m-0">No layout sections yet — add blocks and save a draft layout to preview.</p>;
  }

  return (
    <div className="space-y-3">
      {bindings.map((b) => {
        const mode = renderModeFor(b);
        const cfg = (b.layoutConfig ?? {}) as any;
        const maxPreviewChars = Number.isFinite(Number(cfg?.maxPreviewChars)) ? Number(cfg.maxPreviewChars) : null;
        const bps = mode === 'sms' ? [] : previewBreakpointsFor(b);

        const smsPreview = regions.map(regionPlainText).filter((x) => x.trim().length > 0).join('\n\n').trim();
        const clipped = clipText(smsPreview, maxPreviewChars);

        return (
          <div key={b.id} className="rounded-lg border border-app-border bg-black/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <div className="text-sm text-app-text font-medium">{b.channelName}</div>
                <div className="text-[11px] text-app-faint">{b.channelKey}</div>
              </div>
              <div className="text-[11px] text-app-muted">
                {mode.toUpperCase()}
              </div>
            </div>

            {mode === 'sms' ? (
              <pre className="whitespace-pre-wrap rounded-md border border-app-border/70 bg-black/25 p-3 text-sm text-app-text">
                {clipped.text || '—'}
              </pre>
            ) : (
              <div className={mode === 'email' ? 'w-full max-w-[900px]' : 'w-full'}>
                <div
                  className={`grid gap-3 ${
                    bps.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {bps.map((bp) => (
                    <div key={bp} className="min-w-0">
                      <div className="mb-1 text-[11px] text-app-faint">{bp === 'mobile' ? 'Mobile' : 'Web'}</div>
                      <div
                        className={`rounded-md border border-app-border/70 bg-black/15 p-3 ${
                          bp === 'mobile' ? 'flex justify-center' : ''
                        }`}
                      >
                        <TemplateLayoutLivePreview regions={regions} breakpoint={bp} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === 'sms' && clipped.clipped ? (
              <p className="mt-2 mb-0 text-[11px] text-app-faint">Preview clipped to {maxPreviewChars} chars.</p>
            ) : null}

            <details className="mt-2">
              <summary className="cursor-pointer select-none text-[11px] text-app-faint">Binding config</summary>
              <pre className="mt-2 text-[11px] bg-black/30 border border-app-border rounded p-2 overflow-auto max-h-40">
                {JSON.stringify(b.layoutConfig ?? {}, null, 2)}
              </pre>
            </details>
          </div>
        );
      })}
    </div>
  );
}


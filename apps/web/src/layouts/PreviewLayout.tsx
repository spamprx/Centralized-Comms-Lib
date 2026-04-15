import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Monitor, Smartphone, Tablet, ChevronLeft, Share2, Download } from 'lucide-react';
import { Surface } from '../components/ui/Surface';
import { contentService } from '../services/contentService';
import TipTapReadonly from '../components/editor/TipTapReadonly';

const channels = [
  { id: 'web', name: 'Web', icon: Monitor },
  { id: 'mobile', name: 'Mobile', icon: Smartphone },
  { id: 'tablet', name: 'Tablet', icon: Tablet },
];

export default function PreviewLayout() {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const [activeChannel, setActiveChannel] = useState('web');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('Preview');
  const [bodyDoc, setBodyDoc] = useState<unknown>(null);

  const getPreviewWidth = () => {
    switch (activeChannel) {
      case 'mobile':
        return 375;
      case 'tablet':
        return 768;
      default:
        return '100%';
    }
  };

  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const details = await contentService.getById(contentId);
        if (cancelled) return;
        setTitle(details.content.title || 'Untitled');
        const bodyVersions = (details.versions ?? []).filter(
          (v) =>
            (v.changeType === 'MANUAL_SAVE' || v.changeType === 'AI_GENERATED') && v.body != null,
        );
        if (bodyVersions.length === 0) {
          setBodyDoc(null);
        } else {
          const latestWithBody = bodyVersions.reduce((prev, curr) =>
            curr.versionNumber > prev.versionNumber ? curr : prev,
          );
          setBodyDoc(latestWithBody.body ?? null);
        }
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load content');
        setTitle('Unable to load');
        setBodyDoc(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  const hasTipTapDoc = useMemo(
    () =>
      bodyDoc &&
      typeof bodyDoc === 'object' &&
      bodyDoc !== null &&
      'type' in (bodyDoc as Record<string, unknown>),
    [bodyDoc],
  );

  return (
    <div className="preview-reading-root relative flex h-screen min-h-0 flex-col overflow-hidden bg-app-bg text-app-text">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[42vh] w-[min(100%,720px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(147,124,248,0.07),transparent_62%)]" />
        <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-app-accent-2/6 blur-[80px]" />
      </div>

      <header className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-app-bg/75 px-4 py-2.5 backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/55 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-app-md p-2 text-app-faint transition-colors hover:bg-white/[0.06] hover:text-app-text"
            aria-label="Back"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <div className="flex min-w-0 flex-col gap-0.5 leading-none">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint">
              Preview
            </span>
            <span className="min-w-0 truncate font-serif text-[15px] font-medium tracking-tight text-app-text sm:text-base">
              {title}
            </span>
          </div>
        </div>

        <div className="flex rounded-app-lg border border-white/10 bg-white/[0.03] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
          {channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => setActiveChannel(channel.id)}
              className={`flex items-center gap-1.5 rounded-app-md px-2.5 py-1.5 text-[11px] font-medium transition-[background-color,color,box-shadow] sm:px-3 sm:py-2 sm:text-xs ${
                activeChannel === channel.id
                  ? 'bg-white/[0.1] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-app-faint hover:bg-white/[0.05] hover:text-app-muted'
              }`}
            >
              <channel.icon size={14} className="shrink-0 opacity-90" strokeWidth={2} />
              <span className="hidden sm:inline">{channel.name}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-app-md border border-transparent px-2.5 py-1.5 text-[11px] font-medium text-app-muted transition-colors hover:bg-white/[0.05] hover:text-app-text sm:px-3 sm:py-2 sm:text-xs"
          >
            <Download size={14} strokeWidth={2} /> Export
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-app-md border border-white/12 bg-gradient-to-r from-app-accent to-app-accent-2 px-3 py-1.5 text-[11px] font-semibold text-app-bg shadow-[0_0_20px_-8px_rgba(147,124,248,0.45)] ring-1 ring-white/10 transition-[filter] hover:brightness-105 sm:px-3.5 sm:py-2 sm:text-xs"
          >
            <Share2 size={14} strokeWidth={2} /> Share
          </button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="preview-reading-scroll min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-8 sm:px-8 sm:py-10 md:px-12 md:py-12">
          <div className="mx-auto flex max-w-[min(100%,52rem)] justify-center">
            <article
              style={{ width: getPreviewWidth() }}
              className={`preview-reading-article max-w-full overflow-hidden border border-white/[0.08] bg-[rgba(10,12,18,0.65)] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_40px_100px_-48px_rgba(0,0,0,0.65)] backdrop-blur-xl supports-backdrop-filter:bg-[rgba(10,12,18,0.5)] ${
                activeChannel === 'web'
                  ? 'rounded-app-xl'
                  : 'rounded-[2rem] ring-1 ring-white/[0.1]'
              }`}
            >
              <header className="border-b border-white/[0.06] px-6 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-12">
                <h1 className="m-0 max-w-[34ch] font-serif text-[1.65rem] font-semibold leading-[1.2] tracking-[-0.02em] text-app-text sm:text-[1.85rem]">
                  {title}
                </h1>
                <p className="mt-4 mb-0 max-w-prose text-[13px] leading-relaxed text-app-muted">
                  Last updated: March 11, 2026
                </p>
              </header>

              <div className="px-6 py-10 sm:px-10 sm:py-12">
                {loadError ? (
                  <p className="m-0 text-sm leading-relaxed text-red-400">{loadError}</p>
                ) : loading ? (
                  <p className="m-0 text-[15px] leading-relaxed text-app-faint">Loading preview…</p>
                ) : hasTipTapDoc ? (
                  <div className="tiptap-content">
                    <TipTapReadonly
                      doc={bodyDoc as any}
                      className="ProseMirror preview-reading-prose text-[1.0625rem] leading-[1.75] text-app-text/90 outline-none antialiased"
                    />
                  </div>
                ) : (
                  <p className="m-0 text-[15px] leading-relaxed text-app-faint">
                    No saved body found for this item.
                  </p>
                )}
              </div>

              <footer className="border-t border-white/[0.06] px-6 py-5 sm:px-10">
                <p className="m-0 text-[11px] font-medium tracking-wide text-app-faint">
                  © 2026 CommsLib. All rights reserved.
                </p>
              </footer>
            </article>
          </div>
        </div>

        <Surface
          variant="glass"
          padding="md"
          className="max-h-[36vh] w-full shrink-0 overflow-y-auto border-t border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:max-h-none lg:w-[260px] lg:border-l lg:border-t-0"
        >
          <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-app-faint">
            Conditional sections
          </h3>
          <div className="flex flex-col gap-1.5">
            {[
              { name: 'Introduction', enabled: true },
              { name: 'Getting Started', enabled: true },
              { name: 'Advanced Features', enabled: false },
              { name: 'FAQ', enabled: true },
              { name: 'Related Content', enabled: false },
            ].map((section) => (
              <label
                key={section.name}
                className="flex cursor-pointer items-center justify-between rounded-app-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-white/14 hover:bg-white/[0.05]"
              >
                <span className="text-[12px] text-app-muted">{section.name}</span>
                <input
                  type="checkbox"
                  defaultChecked={section.enabled}
                  className="size-3.5 rounded border-white/20 accent-app-accent"
                />
              </label>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

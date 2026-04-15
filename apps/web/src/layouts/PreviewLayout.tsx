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
    <div className="flex h-screen min-h-0 flex-col bg-app-bg">
      <header className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-app-border/80 bg-app-surface/70 px-4 py-3 shadow-app-soft backdrop-blur-xl supports-[backdrop-filter]:bg-app-surface/50 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-app-md p-2 text-app-faint transition-colors hover:bg-app-elevated hover:text-app-text"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="m-0 shrink-0 text-sm font-semibold text-app-text sm:text-base">Preview</h1>
          <span className="hidden h-4 w-px shrink-0 bg-app-border sm:block" aria-hidden />
          <span className="min-w-0 truncate text-[13px] text-app-muted">{title}</span>
        </div>

        <div className="flex rounded-app-lg border border-app-border/80 bg-app-bg/40 p-1">
          {channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => setActiveChannel(channel.id)}
              className={`flex items-center gap-1.5 rounded-app-md px-3 py-2 text-xs transition-colors ${
                activeChannel === channel.id
                  ? 'bg-app-accent-muted text-app-accent shadow-[0_0_0_1px_rgba(147,124,248,0.2)]'
                  : 'text-app-faint hover:bg-app-elevated hover:text-app-muted'
              }`}
            >
              <channel.icon size={14} className="shrink-0 opacity-90" />
              <span className="hidden sm:inline">{channel.name}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-app-md border border-app-border/80 bg-app-bg/40 px-3 py-2 text-xs text-app-muted transition-colors hover:border-app-accent/25 hover:text-app-text"
          >
            <Download size={14} /> Export
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-app-md border-none bg-gradient-to-br from-app-accent to-app-accent-2 px-3.5 py-2 text-xs font-semibold text-white shadow-app-glow"
          >
            <Share2 size={14} /> Share
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(147,124,248,0.06),transparent_50%)] p-6 md:p-10">
          <div className="mx-auto flex max-w-[1100px] justify-center">
            <div
              style={{ width: getPreviewWidth() }}
              className={`max-w-full overflow-hidden border border-app-border/60 bg-app-surface/90 shadow-app-lift backdrop-blur-sm ${
                activeChannel === 'web'
                  ? 'rounded-app-xl'
                  : 'rounded-[2rem] ring-2 ring-app-border-strong'
              }`}
            >
              <div className="bg-gradient-to-br from-app-accent to-app-accent-2 px-6 py-6 text-white sm:px-8 sm:py-8">
                <h1 className="mb-2 text-2xl font-bold">{title}</h1>
                <p className="m-0 text-[13px] text-white/85">Last updated: March 11, 2026</p>
              </div>

              <div className="p-6 sm:p-8">
                {loadError ? (
                  <p className="m-0 text-sm text-red-300">{loadError}</p>
                ) : loading ? (
                  <p className="m-0 text-sm text-app-faint">Loading preview…</p>
                ) : hasTipTapDoc ? (
                  <div className="tiptap-content">
                    <TipTapReadonly
                      doc={bodyDoc as any}
                      className="ProseMirror text-app-muted leading-relaxed outline-none"
                    />
                  </div>
                ) : (
                  <p className="m-0 text-sm text-app-faint">No saved body found for this item.</p>
                )}
              </div>

              <div className="border-t border-app-border/80 bg-app-surface/50 px-6 py-4 sm:px-8">
                <p className="m-0 text-xs text-app-faint">© 2026 CommsLib. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>

        <Surface
          variant="glass"
          padding="md"
          className="max-h-[40vh] w-full shrink-0 overflow-y-auto border-t border-app-border/80 lg:max-h-none lg:w-[280px] lg:border-l lg:border-t-0"
        >
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-app-faint">
            Conditional sections
          </h3>
          <div className="flex flex-col gap-2">
            {[
              { name: 'Introduction', enabled: true },
              { name: 'Getting Started', enabled: true },
              { name: 'Advanced Features', enabled: false },
              { name: 'FAQ', enabled: true },
              { name: 'Related Content', enabled: false },
            ].map((section) => (
              <label
                key={section.name}
                className="flex cursor-pointer items-center justify-between rounded-app-md border border-app-border/60 bg-app-bg/35 px-3 py-2.5 transition-colors hover:border-app-accent/25"
              >
                <span className="text-xs text-app-muted">{section.name}</span>
                <input
                  type="checkbox"
                  defaultChecked={section.enabled}
                  className="accent-app-accent"
                />
              </label>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

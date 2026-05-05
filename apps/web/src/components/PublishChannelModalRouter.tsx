import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { contentService } from '../services/contentService';
import PublishWhatsAppChannelModal from './PublishWhatsAppChannelModal';
import PublishEmailChannelModal from './PublishEmailChannelModal';
import PublishPushChannelModal from './PublishPushChannelModal';

type Props = {
  contentId: string;
  contentTitle: string;
  onClose: () => void;
  onChooseReviewWorkflow?: () => void;
};

export default function PublishChannelModalRouter({
  contentId,
  contentTitle,
  onClose,
  onChooseReviewWorkflow,
}: Props) {
  const [channelKey, setChannelKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await contentService.getById(contentId);
        if (cancelled) return;
        setChannelKey(details.channel?.key ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load channel');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="rounded-app-xl border border-white/10 bg-app-bg px-8 py-6 text-app-muted shadow-app-lift">
          <div className="inline-flex items-center gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Loading publish modal...
          </div>
        </div>
      </div>
    );
  }

  if (error || !channelKey) {
    return (
      <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-app-xl border border-white/10 bg-app-bg p-5 shadow-app-lift">
          <h3 className="text-sm font-semibold text-app-text">Unable to open publish modal</h3>
          <p className="mt-2 text-xs text-app-muted">{error ?? 'No bound channel found for content.'}</p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-app-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-app-text hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (channelKey === 'whatsapp') {
    return (
      <PublishWhatsAppChannelModal
        contentId={contentId}
        contentTitle={contentTitle}
        onClose={onClose}
        onChooseReviewWorkflow={onChooseReviewWorkflow}
      />
    );
  }
  if (channelKey === 'email') {
    return (
      <PublishEmailChannelModal
        contentId={contentId}
        contentTitle={contentTitle}
        onClose={onClose}
        onChooseReviewWorkflow={onChooseReviewWorkflow}
      />
    );
  }
  if (channelKey === 'push') {
    return (
      <PublishPushChannelModal
        contentId={contentId}
        contentTitle={contentTitle}
        onClose={onClose}
        onChooseReviewWorkflow={onChooseReviewWorkflow}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-app-xl border border-white/10 bg-app-bg p-5 shadow-app-lift">
        <h3 className="text-sm font-semibold text-app-text">Unsupported channel</h3>
        <p className="mt-2 text-xs text-app-muted">
          Channel "{channelKey}" does not have a dedicated publish modal yet.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-app-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-app-text hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

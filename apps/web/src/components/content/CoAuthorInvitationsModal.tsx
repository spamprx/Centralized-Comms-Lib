import { X, Loader2, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export type PendingCoAuthorInvite = {
  contentId: string;
  title: string;
  requestedBy: { displayName: string; email: string };
};

type Props = {
  invitations: PendingCoAuthorInvite[];
  loading: boolean;
  busyContentId: string | null;
  onClose: () => void;
  onRespond: (contentId: string, decision: 'APPROVE' | 'REJECT') => void;
};

export default function CoAuthorInvitationsModal({
  invitations,
  loading,
  busyContentId,
  onClose,
  onRespond,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/95 shadow-app-lift backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="co-invites-modal-title"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-app-md border border-amber-400/35 bg-amber-400/15 text-amber-200">
              <Mail size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="co-invites-modal-title" className="m-0 text-base font-semibold text-app-text">
                Co-author requests
              </h2>
              <p className="mt-0.5 text-[12px] text-app-muted">
                Accept to edit alongside the primary author.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-app-md p-1.5 text-app-faint transition-colors hover:bg-white/8 hover:text-app-text"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-app-muted">
              <Loader2 size={16} className="animate-spin" />
              Loading invitations…
            </div>
          ) : invitations.length === 0 ? (
            <p className="m-0 text-[13px] text-app-muted">No pending co-author invitations.</p>
          ) : (
            <ul className="m-0 list-none space-y-3 p-0">
              {invitations.map((inv) => (
                <li
                  key={inv.contentId}
                  className="rounded-app-lg border border-white/10 bg-app-bg/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <p className="m-0 text-[14px] font-semibold text-app-text">{inv.title}</p>
                  <p className="mt-1 text-[12px] text-app-muted">
                    Invited by <span className="text-app-text">{inv.requestedBy.displayName}</span>
                    <span className="text-app-faint"> · {inv.requestedBy.email}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busyContentId === inv.contentId}
                      onClick={() => onRespond(inv.contentId, 'APPROVE')}
                      className="rounded-app-md bg-emerald-500/90 px-3 py-1.5 text-[12px] font-semibold text-app-bg hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyContentId === inv.contentId ? 'Working…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      disabled={busyContentId === inv.contentId}
                      onClick={() => onRespond(inv.contentId, 'REJECT')}
                      className="rounded-app-md border border-white/15 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-app-muted hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Decline
                    </button>
                    <Link
                      to={`/editor/${inv.contentId}`}
                      className="ml-auto text-[12px] font-medium text-app-accent no-underline hover:underline"
                    >
                      Open editor
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

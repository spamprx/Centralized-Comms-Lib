import { useEffect, useState } from 'react';
import { X, Loader2, Users } from 'lucide-react';
import { contentService } from '../../services/contentService';

type Props = {
  contentId: string;
  contentTitle: string;
  currentUserId: string;
  /** Only the primary author can send email invites. */
  canInvite: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export default function ManageCoAuthorsModal({
  contentId,
  contentTitle,
  currentUserId,
  canInvite,
  onClose,
  onUpdated,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [primaryAuthor, setPrimaryAuthor] = useState<{
    id: string;
    displayName: string;
    email: string;
  } | null>(null);
  const [coAuthors, setCoAuthors] = useState<
    Array<{ id: string; displayName: string; email: string }>
  >([]);
  const [email, setEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await contentService.getById(contentId);
        if (cancelled) return;
        const a = d.content.author;
        setPrimaryAuthor(
          a
            ? { id: a.id, displayName: a.displayName, email: a.email }
            : {
                id: d.content.authorId,
                displayName: 'Unknown',
                email: '',
              },
        );
        setCoAuthors(d.coAuthors ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  const sendInvite = async () => {
    if (!email.trim()) return;
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      await contentService.requestCoAuthorByEmail(contentId, email.trim());
      setEmail('');
      setInviteMsg('Invitation sent. They can accept from My content.');
      const d = await contentService.getById(contentId);
      setCoAuthors(d.coAuthors ?? []);
      onUpdated();
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setInviteBusy(false);
    }
  };

  const you = (id: string) =>
    id === currentUserId ? (
      <span className="ml-1 rounded-md bg-app-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-app-accent">
        You
      </span>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-app-xl border border-white/10 bg-app-bg/95 shadow-app-lift backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="co-authors-modal-title"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-app-md border border-app-accent/30 bg-app-accent/10 text-app-accent">
              <Users size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="co-authors-modal-title" className="m-0 text-base font-semibold text-app-text">
                Co-authors
              </h2>
              <p className="mt-0.5 truncate text-[12px] text-app-muted">{contentTitle}</p>
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
              Loading…
            </div>
          ) : error ? (
            <p className="m-0 text-[13px] text-red-300">{error}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-app-faint">
                  Primary author
                </div>
                {primaryAuthor ? (
                  <div className="rounded-app-md border border-white/10 bg-app-bg/50 px-3 py-2 text-[13px] text-app-text">
                    <span className="font-medium">{primaryAuthor.displayName}</span>
                    {you(primaryAuthor.id)}
                    <div className="mt-0.5 truncate text-[11px] text-app-muted">
                      {primaryAuthor.email}
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-app-faint">
                  Co-authors ({coAuthors.length})
                </div>
                {coAuthors.length === 0 ? (
                  <p className="m-0 text-[12px] text-app-muted">No accepted co-authors yet.</p>
                ) : (
                  <ul className="m-0 list-none space-y-2 p-0">
                    {coAuthors.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-app-md border border-white/10 bg-app-bg/50 px-3 py-2 text-[13px] text-app-text"
                      >
                        <span className="font-medium">{c.displayName}</span>
                        {you(c.id)}
                        <div className="mt-0.5 truncate text-[11px] text-app-muted">{c.email}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canInvite ? (
                <div className="border-t border-white/[0.08] pt-4">
                  <label htmlFor="co-author-invite-email" className="mb-1.5 block text-[12px] font-medium text-app-text">
                    Invite by email
                  </label>
                  <p className="mb-2 text-[11px] leading-snug text-app-faint">
                    They need an existing account. Co-authors can edit but cannot delete this content
                    or invite others.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="co-author-invite-email"
                      type="email"
                      autoComplete="email"
                      placeholder="colleague@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={inviteBusy}
                      className="box-border min-w-0 flex-1 rounded-app-md border border-white/12 bg-app-bg/80 px-3 py-2 text-[13px] text-app-text outline-none placeholder:text-app-faint"
                    />
                    <button
                      type="button"
                      onClick={() => void sendInvite()}
                      disabled={inviteBusy || !email.trim()}
                      className="shrink-0 rounded-app-md bg-gradient-to-r from-app-accent to-app-accent-2 px-4 py-2 text-[13px] font-semibold text-app-bg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {inviteBusy ? 'Sending…' : 'Send invite'}
                    </button>
                  </div>
                  {inviteMsg ? (
                    <p className="mt-2 text-[11px] text-app-muted">{inviteMsg}</p>
                  ) : null}
                </div>
              ) : (
                <p className="m-0 text-[12px] text-app-muted">
                  Only the primary author can send co-author invitations.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

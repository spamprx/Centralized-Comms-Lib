import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Inbox, X } from 'lucide-react';
import { profileService } from '../services/profileService';
import { pushNotificationService, type PushMessage } from '../services/pushNotificationService';

const TOAST_TTL_MS = 6500;
const MAX_TOASTS = 4;
const SESSION_SEEN_KEY = 'comms.push.toasts.seen.ids';

type ToastItem = PushMessage & { id: string; receivedAt: number };

function formatToastAge(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 8) return 'Just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleString();
}

function playNotificationChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    gain.connect(ctx.destination);

    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.setValueAtTime(880, now);
    oscA.connect(gain);
    oscA.start(now);
    oscA.stop(now + 0.12);

    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(1175, now + 0.12);
    oscB.connect(gain);
    oscB.start(now + 0.12);
    oscB.stop(now + 0.32);

    setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 400);
  } catch {
    // Ignore audio failures (autoplay/user-agent restrictions).
  }
}

function readSeenIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_SEEN_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function writeSeenIds(ids: Set<string>): void {
  try {
    sessionStorage.setItem(SESSION_SEEN_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage errors.
  }
}

export default function PushToastHub() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenIds = useMemo(() => readSeenIds(), []);

  const addToast = useCallback((message: PushMessage) => {
    const id = crypto.randomUUID();
    const receivedAt = Date.now();
    setToasts((prev) => [{ id, receivedAt, ...message }, ...prev].slice(0, MAX_TOASTS));
    playNotificationChime();
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  useEffect(() => {
    const unsubscribe = pushNotificationService.subscribeToMessages((message) => {
      addToast(message);
    });
    return unsubscribe;
  }, [addToast]);

  useEffect(() => {
    void (async () => {
      try {
        const unread = await profileService.listPushNotifications(true);
        const recent = unread.slice(0, 3).reverse();
        for (const item of recent) {
          if (seenIds.has(item.id)) continue;
          addToast({ title: item.title, body: item.body });
          seenIds.add(item.id);
        }
        writeSeenIds(seenIds);
      } catch {
        // Non-blocking: toasts still work for live pushes.
      }
    })();
  }, [seenIds, addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(96vw,440px)] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto relative overflow-hidden rounded-app-lg border border-white/[0.14] bg-app-bg/95 shadow-app-lift backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/35 to-transparent" />
          <div className="flex items-start gap-3 p-4 pr-2">
            <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-app-md bg-gradient-to-br from-app-accent/25 to-app-accent/10 text-app-accent ring-1 ring-app-accent/25">
              <Bell size={18} strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="truncate text-[15px] font-semibold leading-snug text-app-text">{toast.title}</div>
              <div className="mt-2 line-clamp-5 text-[13px] leading-relaxed text-app-muted">{toast.body}</div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-3 text-[11px] text-app-faint">
                <span className="tabular-nums" title={new Date(toast.receivedAt).toLocaleString()}>
                  {formatToastAge(toast.receivedAt)}
                </span>
                <span className="text-white/[0.12]" aria-hidden>
                  ·
                </span>
                <span className="text-app-faint">Push · this device</span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <Link
                  to="/profile?tab=notifications"
                  className="pointer-events-auto inline-flex items-center gap-1.5 text-[12px] font-semibold text-app-accent hover:text-app-accent-hover"
                >
                  <Inbox size={14} strokeWidth={2} aria-hidden />
                  View in inbox
                </Link>
                <span className="text-[11px] text-app-faint">Auto-dismisses soon</span>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-app-sm text-app-faint transition-colors hover:bg-white/[0.08] hover:text-app-text"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              aria-label="Dismiss notification"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
          <div className="relative h-1 overflow-hidden bg-white/[0.06]">
            <div
              className="h-full origin-left bg-gradient-to-r from-app-accent to-app-accent-2 motion-reduce:hidden"
              style={{
                animation: `push-toast-dismiss-progress ${TOAST_TTL_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

import { useMemo, useState, type CSSProperties } from 'react';
import { Trash2, UserRoundCheck } from 'lucide-react';
import type { User } from '../../types/admin';

interface UsersTableProps {
  users: User[];
  loading?: boolean;
  /** Map group id → display name for the Groups column */
  groupLookup?: Record<string, string>;
  /** Returns true if accounts were updated (clears selection). False if cancelled or failed. */
  onBulkDeactivate?: (ids: string[]) => Promise<boolean>;
  onBulkActivate?: (ids: string[]) => Promise<boolean>;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Deterministic hue from name string for gradient orb avatars */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ((hash % 360) + 360) % 360;
}

interface RoleBadgeConfig {
  borderColor: string;
  textColor: string;
  glowColor: string;
}

const ROLE_BADGE: Record<User['role'], RoleBadgeConfig> = {
  super_admin: {
    borderColor: 'rgba(251, 191, 36, 0.45)',
    textColor: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.12)',
  },
  admin: {
    borderColor: 'rgba(129, 140, 248, 0.45)',
    textColor: '#818cf8',
    glowColor: 'rgba(129, 140, 248, 0.12)',
  },
  moderator: {
    borderColor: 'rgba(56, 189, 248, 0.45)',
    textColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.12)',
  },
  editor: {
    borderColor: 'rgba(167, 139, 250, 0.45)',
    textColor: '#a78bfa',
    glowColor: 'rgba(167, 139, 250, 0.12)',
  },
  viewer: {
    borderColor: 'rgba(156, 163, 175, 0.35)',
    textColor: '#9ca3af',
    glowColor: 'rgba(156, 163, 175, 0.08)',
  },
};

/** Best-known instant for “last online” (API activity vs optional presence ping from backend). */
function lastOnlineMs(user: User): number {
  const la = new Date(user.lastActive).getTime();
  const pp = user.presencePingAt ? new Date(user.presencePingAt).getTime() : 0;
  return Math.max(la, pp);
}

function formatLastOnline(user: User): string {
  const ms = lastOnlineMs(user);
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ─── Component ────────────────────────────────────────────────────────

export default function UsersTable({
  users,
  loading,
  groupLookup,
  onBulkDeactivate,
  onBulkActivate,
}: UsersTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<'deactivate' | 'activate' | null>(null);

  const { activeSelectedIds, inactiveSelectedIds } = useMemo(() => {
    const selectedUsers = users.filter((u) => selected.has(u.id));
    return {
      activeSelectedIds: selectedUsers.filter((u) => u.isActive).map((u) => u.id),
      inactiveSelectedIds: selectedUsers.filter((u) => !u.isActive).map((u) => u.id),
    };
  }, [users, selected]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === users.length ? new Set() : new Set(users.map((u) => u.id)),
    );

  const runDeactivate = async () => {
    if (!activeSelectedIds.length || !onBulkDeactivate) return;
    setBulkBusy('deactivate');
    try {
      const ok = await onBulkDeactivate(activeSelectedIds);
      if (ok) setSelected(new Set());
    } finally {
      setBulkBusy(null);
    }
  };

  const runActivate = async () => {
    if (!inactiveSelectedIds.length || !onBulkActivate) return;
    setBulkBusy('activate');
    try {
      const ok = await onBulkActivate(inactiveSelectedIds);
      if (ok) setSelected(new Set());
    } finally {
      setBulkBusy(null);
    }
  };

  if (loading)
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="app-skeleton-shimmer h-[52px] rounded-app-lg border border-white/[0.06]"
            style={{ opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    );

  if (!users.length)
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-16 text-center">
        <div className="rounded-app-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-8 py-10 backdrop-blur-sm">
          <p className="m-0 text-sm font-medium text-app-muted">
            No users found matching your criteria.
          </p>
          <p className="mt-1 text-xs text-app-faint">Try adjusting search or filters.</p>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col">
      {selected.size > 0 && (
        <div className="admin-glass relative mb-3 flex flex-wrap items-center gap-2 overflow-hidden rounded-app-xl px-4 py-3 text-[13px] text-app-accent admin-row-enter shadow-[0_0_24px_-10px_rgba(147,124,248,0.35)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-app-accent/40 via-app-accent-2/30 to-transparent" />
          <span className="font-semibold tabular-nums">{selected.size} selected</span>
          {inactiveSelectedIds.length > 0 && onBulkActivate ? (
            <button
              type="button"
              disabled={bulkBusy !== null}
              className="admin-btn-lift flex cursor-pointer items-center gap-1.5 rounded-app-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void runActivate()}
            >
              <UserRoundCheck size={13} strokeWidth={2} />
              {bulkBusy === 'activate' ? 'Activating…' : `Activate (${inactiveSelectedIds.length})`}
            </button>
          ) : null}
          {activeSelectedIds.length > 0 && onBulkDeactivate ? (
            <button
              type="button"
              disabled={bulkBusy !== null}
              className="admin-btn-lift flex cursor-pointer items-center gap-1.5 rounded-app-md border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void runDeactivate()}
            >
              <Trash2 size={13} strokeWidth={2} />
              {bulkBusy === 'deactivate'
                ? 'Deactivating…'
                : `Deactivate (${activeSelectedIds.length})`}
            </button>
          ) : null}
          <button
            type="button"
            className="ml-auto cursor-pointer rounded-app-md border border-transparent bg-transparent px-2 py-1 text-xs font-medium text-app-faint transition-colors hover:bg-white/[0.06] hover:text-app-text"
            onClick={() => setSelected(new Set())}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-app-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent shadow-app-lift backdrop-blur-xl">
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="bg-app-bg/40">
                <th className="w-11 whitespace-nowrap border-b border-white/[0.08] bg-transparent px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-app-faint">
                  <input
                    type="checkbox"
                    checked={selected.size === users.length && users.length > 0}
                    onChange={toggleAll}
                    className="accent-app-accent cursor-pointer"
                  />
                </th>
                {['User', 'Account', 'Role', 'Groups', 'Last online'].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap border-b border-white/[0.08] bg-transparent px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-app-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => {
                const isSelected = selected.has(user.id);
                const hue = nameToHue(user.name);
                const badge = ROLE_BADGE[user.role] ?? ROLE_BADGE.viewer;

                return (
                  <tr
                    key={user.id}
                    className={`admin-row-enter group transition-[background-color] duration-200 ${
                      isSelected ? 'bg-app-accent-muted/80' : ''
                    } ${!user.isActive ? 'opacity-[0.92]' : ''}`}
                    style={
                      {
                        '--row-index': idx,
                      } as CSSProperties
                    }
                  >
                    <td className="w-11 border-b border-white/[0.05] px-4 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(user.id)}
                        className="accent-app-accent cursor-pointer"
                      />
                    </td>

                    <td className="relative border-b border-white/[0.05] px-4 py-3 align-middle group-hover:bg-white/[0.02]">
                      <div className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-gradient-to-b from-app-accent to-app-accent-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)] ring-2 ring-white/10"
                          style={{
                            background: `linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${hue + 40}, 50%, 55%))`,
                            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                          }}
                        >
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            user.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="text-[13px] font-medium text-app-text">{user.name}</div>
                          <div className="text-[11px] text-app-faint">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="border-b border-white/[0.05] px-4 py-3 align-middle group-hover:bg-white/[0.02]">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${
                          user.isActive
                            ? 'border border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                            : 'border border-white/[0.1] bg-white/[0.04] text-app-faint'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="border-b border-white/[0.05] px-4 py-3 align-middle group-hover:bg-white/[0.02]">
                      <span
                        className="inline-block whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-semibold capitalize"
                        style={{
                          color: badge.textColor,
                          border: `1px solid ${badge.borderColor}`,
                          background: badge.glowColor,
                          boxShadow: `0 0 8px ${badge.glowColor}`,
                        }}
                      >
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="border-b border-white/[0.05] px-4 py-3 align-middle group-hover:bg-white/[0.02]">
                      <div className="flex flex-wrap gap-1">
                        {user.groups.slice(0, 2).map((g) => (
                          <span
                            key={g}
                            className="whitespace-nowrap rounded-app-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-app-muted"
                          >
                            {groupLookup?.[g] ?? g}
                          </span>
                        ))}
                        {user.groups.length > 2 && (
                          <span className="whitespace-nowrap rounded-app-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[11px] text-app-faint">
                            +{user.groups.length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="border-b border-white/[0.05] px-4 py-3 align-middle group-hover:bg-white/[0.02]">
                      <span className="whitespace-nowrap text-[12px] text-app-faint tabular-nums">
                        {formatLastOnline(user)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

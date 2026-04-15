import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Trash2, Edit2, Lock, CheckCircle2 } from 'lucide-react';
import type { User } from '../../types/admin';

interface UsersTableProps {
  users: User[];
  loading?: boolean;
  /** Map group id → display name for the Groups column */
  groupLookup?: Record<string, string>;
  onEdit?: (user: User) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: User['status']) => void;
  onBulkDelete?: (ids: string[]) => void;
  onResetPassword?: (id: string) => void;
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

const STATUS_DOT_CLASS: Record<User['status'], string> = {
  active: 'admin-status-dot admin-status-dot--active',
  inactive: 'admin-status-dot admin-status-dot--inactive',
};

const STATUS_LABEL: Record<User['status'], string> = {
  active: 'Active',
  inactive: 'Inactive',
};

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

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** 0-100 recency percent: 100 = just now, 0 = 30+ days */
function recencyPercent(dateStr: string): number {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.min(100, (1 - diffMs / thirtyDays) * 100));
}

type MenuAnchor = { userId: string; top: number; left: number };

const MENU_WIDTH = 184;

// ─── Component ────────────────────────────────────────────────────────

export default function UsersTable({
  users,
  loading,
  groupLookup,
  onEdit,
  onDelete,
  onStatusChange,
  onBulkDelete,
  onResetPassword,
}: UsersTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuPanelRef.current?.contains(t)) return;
      if ((e.target as HTMLElement).closest('[data-admin-user-menu-btn]')) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === users.length ? new Set() : new Set(users.map((u) => u.id)),
    );
  const handleBulkDelete = () => {
    if (selected.size && onBulkDelete) {
      onBulkDelete(Array.from(selected));
      setSelected(new Set());
    }
  };

  const openMenuFor = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    const rect = btn.getBoundingClientRect();
    const left = Math.min(window.innerWidth - MENU_WIDTH - 8, Math.max(8, rect.right - MENU_WIDTH));
    const top = rect.bottom + 6;
    setMenu((cur) => (cur?.userId === userId ? null : { userId, top, left }));
  };

  const menuUser = menu ? users.find((u) => u.id === menu.userId) : null;

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
        <div className="admin-glass relative mb-3 flex items-center gap-3 overflow-hidden rounded-app-xl px-4 py-3 text-[13px] text-app-accent admin-row-enter shadow-[0_0_24px_-10px_rgba(147,124,248,0.35)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-app-accent/40 via-app-accent-2/30 to-transparent" />
          <span className="font-semibold tabular-nums">{selected.size} selected</span>
          <button
            type="button"
            className="admin-btn-lift flex cursor-pointer items-center gap-1.5 rounded-app-md border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15"
            onClick={handleBulkDelete}
          >
            <Trash2 size={13} strokeWidth={2} /> Deactivate
          </button>
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
          <table className="w-full min-w-[720px] border-collapse">
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
                {['User', 'Role', 'Status', 'Groups', 'Last Active', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`whitespace-nowrap border-b border-white/[0.08] bg-transparent px-4 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-app-faint ${
                      i === 5 ? 'w-[50px]' : ''
                    }`}
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
                const recency = recencyPercent(user.lastActive);

                return (
                  <tr
                    key={user.id}
                    className={`admin-row-enter group transition-[background-color] duration-200 ${
                      isSelected ? 'bg-app-accent-muted/80' : ''
                    }`}
                    style={
                      {
                        '--row-index': idx,
                      } as React.CSSProperties
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
                      <div className="flex items-center gap-2">
                        <span className={STATUS_DOT_CLASS[user.status]} />
                        <span className="text-[12px] text-app-muted">
                          {STATUS_LABEL[user.status]}
                        </span>
                      </div>
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
                      <span className="whitespace-nowrap text-[12px] text-app-faint">
                        {formatRelative(user.lastActive)}
                      </span>
                      <div className="admin-recency-bar" style={{ width: 60 }}>
                        <div className="admin-recency-bar-fill" style={{ width: `${recency}%` }} />
                      </div>
                    </td>

                    <td className="w-[50px] border-b border-white/[0.05] px-4 py-3 align-middle group-hover:bg-white/[0.02]">
                      <button
                        type="button"
                        data-admin-user-menu-btn
                        aria-expanded={menu?.userId === user.id}
                        aria-haspopup="menu"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-app-md border border-transparent bg-transparent text-app-faint transition-[border-color,background-color,color] duration-150 hover:border-white/[0.1] hover:bg-white/[0.06] hover:text-app-muted"
                        onClick={(e) => openMenuFor(e, user.id)}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {menu &&
        menuUser &&
        createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            className="admin-modal-enter admin-modal-panel fixed z-[1150] rounded-app-xl p-1.5 shadow-app-soft"
            style={{
              top: menu.top,
              left: menu.left,
              width: MENU_WIDTH,
            }}
          >
            {onEdit && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2 rounded-app-md border border-transparent bg-transparent px-3 py-2 text-left text-[13px] text-app-muted transition-colors duration-150 hover:border-white/[0.06] hover:bg-white/[0.06]"
                onClick={() => {
                  onEdit(menuUser);
                  setMenu(null);
                }}
              >
                <Edit2 size={13} /> Edit user
              </button>
            )}
            {onResetPassword && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2 rounded-app-md border border-transparent bg-transparent px-3 py-2 text-left text-[13px] text-app-muted transition-colors duration-150 hover:border-white/[0.06] hover:bg-white/[0.06]"
                onClick={() => {
                  void onResetPassword(menuUser.id);
                  setMenu(null);
                }}
              >
                <Lock size={13} /> Reset password
              </button>
            )}
            {onDelete && menuUser.status === 'active' && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2 rounded-app-md border border-transparent bg-transparent px-3 py-2 text-left text-[13px] text-red-400 transition-colors duration-150 hover:border-red-400/25 hover:bg-red-500/10"
                onClick={() => {
                  void onDelete(menuUser.id);
                  setMenu(null);
                }}
              >
                <Trash2 size={13} /> Deactivate
              </button>
            )}
            {onStatusChange && menuUser.status === 'inactive' && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2 rounded-app-md border border-transparent bg-transparent px-3 py-2 text-left text-[13px] text-app-muted transition-colors duration-150 hover:border-white/[0.06] hover:bg-white/[0.06]"
                onClick={() => {
                  void onStatusChange(menuUser.id, 'active');
                  setMenu(null);
                }}
              >
                <CheckCircle2 size={13} /> Reactivate
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

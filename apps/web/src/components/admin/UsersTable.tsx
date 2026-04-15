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
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[52px] rounded-xl animate-pulse"
            style={{
              opacity: 1 - i * 0.12,
              background: 'rgba(255,255,255,0.035)',
            }}
          />
        ))}
      </div>
    );

  if (!users.length)
    return (
      <div className="flex items-center justify-center p-[60px] text-app-faint text-sm">
        No users found matching your criteria.
      </div>
    );

  return (
    <div className="flex flex-col">
      {selected.size > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 admin-glass rounded-xl mb-3 text-[13px] text-app-accent admin-row-enter">
          <span className="font-medium">{selected.size} selected</span>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400 text-xs cursor-pointer admin-btn-lift"
            onClick={handleBulkDelete}
          >
            <Trash2 size={13} /> Deactivate
          </button>
          <button
            className="bg-transparent border-none text-app-faint text-xs cursor-pointer ml-1 hover:text-app-text"
            onClick={() => setSelected(new Set())}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="rounded-xl admin-glass" style={{ border: 'none' }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold tracking-wide uppercase text-app-faint bg-transparent border-b border-white/[0.04] whitespace-nowrap w-11">
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
                    className={`px-4 py-3 text-left text-[11px] font-semibold tracking-wide uppercase text-app-faint bg-transparent border-b border-white/[0.04] whitespace-nowrap ${
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
                    className={`admin-row-enter group transition-colors duration-100 ${
                      isSelected ? 'bg-app-accent-muted' : ''
                    }`}
                    style={
                      {
                        '--row-index': idx,
                      } as React.CSSProperties
                    }
                  >
                    <td className="px-4 py-3 align-middle w-11 border-b border-white/[0.03]">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(user.id)}
                        className="accent-app-accent cursor-pointer"
                      />
                    </td>

                    <td className="px-4 py-3 align-middle border-b border-white/[0.03] relative group-hover:bg-app-elevated/30">
                      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-app-accent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                          style={{
                            background: `linear-gradient(135deg, hsl(${hue}, 60%, 45%), hsl(${hue + 40}, 50%, 55%))`,
                            color: '#fff',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
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

                    <td className="px-4 py-3 align-middle border-b border-white/[0.03] group-hover:bg-app-elevated/30">
                      <span
                        className="inline-block px-2.5 py-[3px] rounded-full text-[11px] font-medium capitalize whitespace-nowrap"
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

                    <td className="px-4 py-3 align-middle border-b border-white/[0.03] group-hover:bg-app-elevated/30">
                      <div className="flex items-center gap-2">
                        <span className={STATUS_DOT_CLASS[user.status]} />
                        <span className="text-[12px] text-app-muted">
                          {STATUS_LABEL[user.status]}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 align-middle border-b border-white/[0.03] group-hover:bg-app-elevated/30">
                      <div className="flex flex-wrap gap-1">
                        {user.groups.slice(0, 2).map((g) => (
                          <span
                            key={g}
                            className="px-2 py-0.5 bg-white/[0.04] rounded-md text-[11px] text-app-muted whitespace-nowrap"
                          >
                            {groupLookup?.[g] ?? g}
                          </span>
                        ))}
                        {user.groups.length > 2 && (
                          <span className="px-2 py-0.5 bg-white/[0.04] rounded-md text-[11px] text-app-faint whitespace-nowrap">
                            +{user.groups.length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 align-middle border-b border-white/[0.03] group-hover:bg-app-elevated/30">
                      <span className="text-[12px] text-app-faint whitespace-nowrap">
                        {formatRelative(user.lastActive)}
                      </span>
                      <div className="admin-recency-bar" style={{ width: 60 }}>
                        <div className="admin-recency-bar-fill" style={{ width: `${recency}%` }} />
                      </div>
                    </td>

                    <td className="px-4 py-3 align-middle border-b border-white/[0.03] w-[50px] group-hover:bg-app-elevated/30">
                      <button
                        type="button"
                        data-admin-user-menu-btn
                        aria-expanded={menu?.userId === user.id}
                        aria-haspopup="menu"
                        className="flex items-center justify-center w-[30px] h-[30px] bg-transparent border-none rounded-lg text-app-faint cursor-pointer transition-all duration-150 hover:bg-app-surface-hover hover:text-app-muted"
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
            className="fixed z-[1150] admin-glass rounded-xl p-1.5 shadow-app-soft admin-modal-enter"
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
                className="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none rounded-lg text-app-muted text-[13px] cursor-pointer text-left transition-colors duration-100 hover:bg-app-surface-hover"
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
                className="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none rounded-lg text-app-muted text-[13px] cursor-pointer text-left transition-colors duration-100 hover:bg-app-surface-hover"
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
                className="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none rounded-lg text-red-400 text-[13px] cursor-pointer text-left transition-colors duration-100 hover:bg-red-400/10"
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
                className="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none rounded-lg text-app-muted text-[13px] cursor-pointer text-left transition-colors duration-100 hover:bg-app-surface-hover"
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

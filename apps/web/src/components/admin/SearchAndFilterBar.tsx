import { Search, X } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { UserFilters } from '../../types/admin';

interface SearchAndFilterBarProps {
  filters: Partial<UserFilters>;
  onFilterChange: (filters: Partial<UserFilters>) => void;
  groups?: { id: string; name: string }[];
  totalResults?: number;
  loading?: boolean;
}

const STATUS_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export default function SearchAndFilterBar({
  filters,
  onFilterChange,
  groups = [],
  totalResults,
  loading,
}: SearchAndFilterBarProps) {
  const [showRoleFilters, setShowRoleFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Active status chip index for sliding indicator
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  const currentStatus = filters.accountStatus || 'all';
  const activeIdx = STATUS_CHIPS.findIndex((c) => c.value === currentStatus);

  const updateIndicator = useCallback(() => {
    const btn = chipRefs.current[activeIdx];
    const container = containerRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setIndicatorStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [activeIdx]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator, currentStatus]);

  // ⌘K keyboard shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const ROLES = ['all', 'super_admin', 'admin', 'moderator', 'editor', 'viewer'] as const;

  const selectClass =
    'rounded-app-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[13px] text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none backdrop-blur-md transition-[border-color,box-shadow] duration-200 hover:border-white/[0.14] focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/15 cursor-pointer';

  return (
    <div className="admin-glass relative flex flex-col gap-4 overflow-hidden rounded-app-xl p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="relative flex flex-wrap items-center gap-2.5">
        {/* Command palette search */}
        <div className="relative flex min-w-[220px] max-w-[400px] flex-1 items-center">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 text-app-faint"
            strokeWidth={2}
          />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search users…"
            value={filters.search ?? ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full rounded-app-lg border border-white/[0.1] bg-app-bg/40 py-2.5 pl-10 pr-10 text-[13px] text-app-text shadow-inner outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-200 placeholder:text-app-faint focus:border-app-accent/45 focus:ring-2 focus:ring-app-accent/12"
          />
          {filters.search ? (
            <button
              type="button"
              className="absolute right-2.5 flex rounded-app-md p-1.5 text-app-faint transition-colors hover:bg-white/[0.06] hover:text-app-text"
              onClick={() => onFilterChange({ ...filters, search: '' })}
            >
              <X size={14} strokeWidth={2} />
            </button>
          ) : null}
        </div>

        {/* Sort */}
        <select
          value={`${filters.sortBy ?? 'createdAt'}:${filters.sortOrder ?? 'desc'}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split(':') as [
              UserFilters['sortBy'],
              UserFilters['sortOrder'],
            ];
            onFilterChange({ ...filters, sortBy, sortOrder });
          }}
          className={selectClass}
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="name:asc">Name A→Z</option>
          <option value="name:desc">Name Z→A</option>
          <option value="lastActive:desc">Last online (newest)</option>
        </select>

        {/* Role filter toggle */}
        {groups.length > 0 && (
          <select
            value={filters.group ?? 'all'}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                group: e.target.value as UserFilters['group'],
              })
            }
            className={selectClass}
          >
            <option value="all">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}

        {totalResults !== undefined && (
          <span className="ml-auto rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-app-muted backdrop-blur-sm">
            {loading ? '…' : `${totalResults} result${totalResults !== 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      {/* Segmented status filter chips */}
      <div className="relative flex flex-wrap items-center gap-3">
        <div ref={containerRef} className="admin-pill-toggle">
          {/* Sliding indicator */}
          <div
            className="admin-pill-toggle-indicator"
            style={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
          />
          {STATUS_CHIPS.map((chip, idx) => (
            <button
              key={chip.value}
              ref={(el) => {
                chipRefs.current[idx] = el;
              }}
              type="button"
              data-active={currentStatus === chip.value}
              onClick={() =>
                onFilterChange({
                  ...filters,
                  accountStatus: chip.value as UserFilters['accountStatus'],
                })
              }
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Role pills */}
        <button
          type="button"
          className={`rounded-app-md border px-3 py-1.5 text-[12px] font-medium transition-[border-color,background-color,color,box-shadow] duration-200 ${
            showRoleFilters
              ? 'border-app-accent/35 bg-app-accent-muted text-app-accent shadow-[0_0_20px_-8px_rgba(147,124,248,0.4)]'
              : 'border-white/[0.1] bg-transparent text-app-faint hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-app-muted'
          }`}
          onClick={() => setShowRoleFilters((v) => !v)}
        >
          Role filter
        </button>
      </div>

      {showRoleFilters && (
        <div className="flex gap-1.5 flex-wrap admin-row-enter">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-[border-color,background-color,color,transform] duration-200 admin-btn-lift motion-reduce:transition-none ${
                filters.role === role || (!filters.role && role === 'all')
                  ? 'border-app-accent/40 bg-gradient-to-b from-app-accent-muted to-app-accent-muted/40 text-app-accent shadow-[0_0_16px_-6px_rgba(147,124,248,0.45)]'
                  : 'border-white/[0.08] bg-white/[0.03] text-app-muted hover:border-white/[0.14] hover:bg-white/[0.06]'
              }`}
              onClick={() => onFilterChange({ ...filters, role })}
            >
              {role === 'all' ? 'All roles' : role.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const currentStatus = filters.status || 'all';
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
    'px-2.5 py-[7px] bg-app-surface border border-app-border rounded-lg text-app-muted text-[13px] cursor-pointer outline-none';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Command palette search */}
        <div className="relative flex items-center flex-1 min-w-[220px] max-w-[400px]">
          <Search size={15} className="absolute left-3 text-app-faint pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search users…"
            value={filters.search ?? ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full py-2.5 pr-10 pl-[34px] bg-app-surface border border-app-border rounded-xl text-app-text text-[13px] outline-none transition-all duration-200 focus:border-app-accent/40 focus:shadow-[0_0_0_3px_rgba(147,124,248,0.08)] placeholder:text-app-faint"
          />
          {filters.search ? (
            <button
              className="absolute right-3 bg-transparent border-none text-app-faint cursor-pointer flex p-1 hover:text-app-text"
              onClick={() => onFilterChange({ ...filters, search: '' })}
            >
              <X size={13} />
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
          <option value="lastActive:desc">Recently active</option>
        </select>

        {/* Role filter toggle */}
        {groups.length > 0 && (
          <select
            value={filters.group ?? 'all'}
            onChange={(e) => onFilterChange({ ...filters, group: e.target.value as any })}
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
          <span className="ml-auto text-xs text-app-faint">
            {loading ? '…' : `${totalResults} result${totalResults !== 1 ? 's' : ''}`}
          </span>
        )}
      </div>

      {/* Segmented status filter chips */}
      <div className="flex items-center gap-3">
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
              onClick={() => onFilterChange({ ...filters, status: chip.value as any })}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Role pills */}
        <button
          type="button"
          className={`text-[12px] px-2.5 py-1 rounded-lg border transition-colors duration-150 ${
            showRoleFilters
              ? 'bg-app-accent-muted border-app-accent/30 text-app-accent'
              : 'bg-transparent border-app-border text-app-faint hover:text-app-muted hover:border-white/15'
          }`}
          onClick={() => setShowRoleFilters((v) => !v)}
        >
          Role filter
        </button>
      </div>

      {/* Role filter row */}
      {showRoleFilters && (
        <div className="flex gap-1.5 flex-wrap admin-row-enter">
          {ROLES.map((role) => (
            <button
              key={role}
              className={`px-2.5 py-1 rounded-[20px] border text-xs cursor-pointer capitalize transition-all duration-150 admin-btn-lift ${
                filters.role === role || (!filters.role && role === 'all')
                  ? 'bg-app-accent-muted border-app-accent/35 text-app-accent'
                  : 'bg-app-surface border-app-border text-app-muted hover:border-white/20 hover:text-app-muted'
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

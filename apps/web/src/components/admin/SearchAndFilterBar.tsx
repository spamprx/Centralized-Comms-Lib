import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import type { UserFilters } from '../../types/admin';

interface SearchAndFilterBarProps {
  filters: Partial<UserFilters>;
  onFilterChange: (filters: Partial<UserFilters>) => void;
  groups?: { id: string; name: string }[];
  totalResults?: number;
  loading?: boolean;
}

const ROLES   = ['all', 'super_admin', 'admin', 'moderator', 'editor', 'viewer'] as const;
const STATUSES = ['all', 'active', 'inactive', 'suspended', 'pending'] as const;

export default function SearchAndFilterBar({ filters, onFilterChange, groups = [], totalResults, loading }: SearchAndFilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = filters.role !== 'all' || filters.status !== 'all' || filters.group !== 'all';

  const clearFilters = () => onFilterChange({ ...filters, role: 'all', status: 'all', group: 'all', search: '' });

  const selectClass = "px-2.5 py-[7px] bg-white/[0.04] border border-white/10 rounded-lg text-[#9094ae] text-[13px] cursor-pointer outline-none";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex items-center flex-1 min-w-[220px] max-w-[400px]">
          <Search size={15} className="absolute left-2.5 text-[#555870] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={filters.search ?? ''}
            onChange={e => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full py-2 pr-2.5 pl-[34px] bg-white/[0.04] border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] outline-none transition-colors duration-150 focus:border-violet-400/50 placeholder:text-[#555870]"
          />
          {filters.search && (
            <button className="absolute right-2 bg-transparent border-none text-[#555870] cursor-pointer flex p-0.5" onClick={() => onFilterChange({ ...filters, search: '' })}>
              <X size={13} />
            </button>
          )}
        </div>

        <button
          className={`flex items-center gap-1.5 px-3 py-[7px] border rounded-lg text-[13px] cursor-pointer relative transition-all duration-150 ${
            showFilters
              ? 'bg-violet-400/10 border-violet-400/30 text-violet-400'
              : 'bg-white/[0.04] border-white/10 text-[#9094ae] hover:bg-violet-400/10 hover:border-violet-400/30 hover:text-violet-400'
          }`}
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal size={14} /> Filters
          {hasActiveFilters && <span className="absolute top-[5px] right-[5px] w-1.5 h-1.5 rounded-full bg-violet-400" />}
        </button>

        {hasActiveFilters && (
          <button className="flex items-center gap-1 px-2.5 py-[7px] bg-transparent border-none text-gray-500 text-xs cursor-pointer hover:text-[#e2e4f0]" onClick={clearFilters}><X size={13} /> Clear</button>
        )}

        {totalResults !== undefined && (
          <span className="ml-auto text-xs text-[#555870]">{loading ? '…' : `${totalResults} result${totalResults !== 1 ? 's' : ''}`}</span>
        )}

        <div>
          <select
            value={`${filters.sortBy ?? 'createdAt'}:${filters.sortOrder ?? 'desc'}`}
            onChange={e => {
              const [sortBy, sortOrder] = e.target.value.split(':') as [UserFilters['sortBy'], UserFilters['sortOrder']];
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
        </div>
      </div>

      {showFilters && (
        <div className="flex gap-5 px-3.5 py-3 bg-white/[0.025] border border-white/[0.07] rounded-lg flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-wide uppercase text-[#555870]">Role</label>
            <div className="flex gap-1.5 flex-wrap">
              {ROLES.map(role => (
                <button
                  key={role}
                  className={`px-2.5 py-1 rounded-[20px] border text-xs cursor-pointer capitalize transition-all duration-150 ${
                    filters.role === role || (!filters.role && role === 'all')
                      ? 'bg-violet-400/15 border-violet-400/40 text-violet-400'
                      : 'bg-white/5 border-white/[0.08] text-[#8b8fa8] hover:border-white/20 hover:text-[#c4c7d9]'
                  }`}
                  onClick={() => onFilterChange({ ...filters, role })}
                >
                  {role === 'all' ? 'All roles' : role.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold tracking-wide uppercase text-[#555870]">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {STATUSES.map(status => (
                <button
                  key={status}
                  className={`px-2.5 py-1 rounded-[20px] border text-xs cursor-pointer capitalize transition-all duration-150 ${
                    filters.status === status || (!filters.status && status === 'all')
                      ? 'bg-violet-400/15 border-violet-400/40 text-violet-400'
                      : 'bg-white/5 border-white/[0.08] text-[#8b8fa8] hover:border-white/20 hover:text-[#c4c7d9]'
                  }`}
                  onClick={() => onFilterChange({ ...filters, status })}
                >
                  {status === 'all' ? 'All statuses' : status}
                </button>
              ))}
            </div>
          </div>
          {groups.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold tracking-wide uppercase text-[#555870]">Group</label>
              <select value={filters.group ?? 'all'} onChange={e => onFilterChange({ ...filters, group: e.target.value as any })} className={selectClass}>
                <option value="all">All groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
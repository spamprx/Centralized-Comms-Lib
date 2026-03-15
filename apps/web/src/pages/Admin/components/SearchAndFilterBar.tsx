import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import type { UserFilters } from '../../../types/admin';

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

  return (
    <div className="sfb-wrapper">
      <div className="sfb-row">
        <div className="sfb-search">
          <Search size={15} className="sfb-search__icon" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={filters.search ?? ''}
            onChange={e => onFilterChange({ ...filters, search: e.target.value })}
            className="sfb-search__input"
          />
          {filters.search && (
            <button className="sfb-search__clear" onClick={() => onFilterChange({ ...filters, search: '' })}>
              <X size={13} />
            </button>
          )}
        </div>

        <button className={`sfb-filter-btn ${showFilters ? 'sfb-filter-btn--active' : ''}`} onClick={() => setShowFilters(v => !v)}>
          <SlidersHorizontal size={14} /> Filters
          {hasActiveFilters && <span className="sfb-filter-badge" />}
        </button>

        {hasActiveFilters && (
          <button className="sfb-clear-btn" onClick={clearFilters}><X size={13} /> Clear</button>
        )}

        {totalResults !== undefined && (
          <span className="sfb-count">{loading ? '…' : `${totalResults} result${totalResults !== 1 ? 's' : ''}`}</span>
        )}

        <div className="sfb-sort">
          <select
            value={`${filters.sortBy ?? 'createdAt'}:${filters.sortOrder ?? 'desc'}`}
            onChange={e => {
              const [sortBy, sortOrder] = e.target.value.split(':') as [UserFilters['sortBy'], UserFilters['sortOrder']];
              onFilterChange({ ...filters, sortBy, sortOrder });
            }}
            className="sfb-select"
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
        <div className="sfb-filters">
          <div className="sfb-filter-group">
            <label className="sfb-label">Role</label>
            <div className="sfb-chips">
              {ROLES.map(role => (
                <button key={role} className={`sfb-chip ${filters.role === role || (!filters.role && role === 'all') ? 'sfb-chip--active' : ''}`} onClick={() => onFilterChange({ ...filters, role })}>
                  {role === 'all' ? 'All roles' : role.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="sfb-filter-group">
            <label className="sfb-label">Status</label>
            <div className="sfb-chips">
              {STATUSES.map(status => (
                <button key={status} className={`sfb-chip ${filters.status === status || (!filters.status && status === 'all') ? 'sfb-chip--active' : ''}`} onClick={() => onFilterChange({ ...filters, status })}>
                  {status === 'all' ? 'All statuses' : status}
                </button>
              ))}
            </div>
          </div>
          {groups.length > 0 && (
            <div className="sfb-filter-group">
              <label className="sfb-label">Group</label>
              <select value={filters.group ?? 'all'} onChange={e => onFilterChange({ ...filters, group: e.target.value as any })} className="sfb-select">
                <option value="all">All groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <style>{`
        .sfb-wrapper { display:flex; flex-direction:column; gap:12px; }
        .sfb-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .sfb-search { position:relative; display:flex; align-items:center; flex:1; min-width:220px; max-width:400px; }
        .sfb-search__icon { position:absolute; left:10px; color:#555870; pointer-events:none; }
        .sfb-search__input { width:100%; padding:8px 10px 8px 34px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#e2e4f0; font-size:13px; outline:none; transition:border-color 0.15s; }
        .sfb-search__input:focus { border-color:rgba(167,139,250,0.5); }
        .sfb-search__input::placeholder { color:#555870; }
        .sfb-search__clear { position:absolute; right:8px; background:none; border:none; color:#555870; cursor:pointer; display:flex; padding:2px; }
        .sfb-filter-btn { display:flex; align-items:center; gap:6px; padding:7px 12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#9094ae; font-size:13px; cursor:pointer; position:relative; transition:all 0.15s; }
        .sfb-filter-btn:hover, .sfb-filter-btn--active { background:rgba(167,139,250,0.1); border-color:rgba(167,139,250,0.3); color:#a78bfa; }
        .sfb-filter-badge { position:absolute; top:5px; right:5px; width:6px; height:6px; border-radius:50%; background:#a78bfa; }
        .sfb-clear-btn { display:flex; align-items:center; gap:4px; padding:7px 10px; background:none; border:none; color:#6b7280; font-size:12px; cursor:pointer; }
        .sfb-clear-btn:hover { color:#e2e4f0; }
        .sfb-count { margin-left:auto; font-size:12px; color:#555870; }
        .sfb-select { padding:7px 10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#9094ae; font-size:13px; cursor:pointer; outline:none; }
        .sfb-filters { display:flex; gap:20px; padding:12px 14px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:8px; flex-wrap:wrap; }
        .sfb-filter-group { display:flex; flex-direction:column; gap:6px; }
        .sfb-label { font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#555870; }
        .sfb-chips { display:flex; gap:6px; flex-wrap:wrap; }
        .sfb-chip { padding:4px 10px; border-radius:20px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); color:#8b8fa8; font-size:12px; cursor:pointer; text-transform:capitalize; transition:all 0.15s; }
        .sfb-chip:hover { border-color:rgba(255,255,255,0.2); color:#c4c7d9; }
        .sfb-chip--active { background:rgba(167,139,250,0.15); border-color:rgba(167,139,250,0.4); color:#a78bfa; }
      `}</style>
    </div>
  );
}
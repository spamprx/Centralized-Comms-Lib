import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  Eye,
  FileText,
  Grid3x3,
  Image,
  LayoutGrid,
  List,
  Music,
  Search,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';

const BG = '#0d0f18';
const SURFACE = '#12141e';
const CARD = '#16192a';
const THUMB_BG = '#1c1f2e';
const BORDER = 'rgba(255,255,255,0.07)';
const BORDER_STRONG = 'rgba(255,255,255,0.09)';
const BORDER_CHIP = 'rgba(255,255,255,0.1)';
const MUTED = '#8b90a4';
const WHITE = '#ffffff';
const PURPLE = '#7C6FF7';
const AMBER = '#EF9F27';
const TEAL = '#1D9E75';
const DOC_BLUE = '#378ADD';
const DANGER = '#E24B4A';

type AssetType = 'image' | 'video' | 'audio' | 'document';

type Asset = {
  id: string;
  name: string;
  extLabel: string;
  type: AssetType;
  size: string;
  sizeBytes: number;
  uploadedAt: string;
  dateAdded: number;
};

const TYPE_ICON = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
} as const;

const TYPE_COLOR = {
  image: PURPLE,
  video: AMBER,
  audio: TEAL,
  document: DOC_BLUE,
} as const;

const EXT_BY_TYPE: Record<AssetType, string[]> = {
  image: ['PNG', 'JPG', 'WEBP'],
  video: ['MP4', 'MOV'],
  audio: ['MP3', 'WAV'],
  document: ['PDF', 'DOCX'],
};

function buildMockAssets(): Asset[] {
  const types: AssetType[] = ['image', 'image', 'document', 'video', 'audio'];
  const base = Date.now() - 45 * 24 * 60 * 60 * 1000;
  return Array.from({ length: 24 }, (_, i) => {
    const type = types[i % types.length];
    const extPool = EXT_BY_TYPE[type];
    const extLabel = extPool[i % extPool.length];
    const name = `campaign_${String(i + 1).padStart(2, '0')}.${extLabel.toLowerCase()}`;
    const mb = 0.3 + (i % 7) * 0.4 + (i % 3) * 0.15;
    const dateAdded = base + i * 36 * 60 * 60 * 1000;
    return {
      id: `asset-${i + 1}`,
      name,
      extLabel,
      type,
      size: `${mb.toFixed(1)} MB`,
      sizeBytes: mb * 1024 * 1024,
      uploadedAt: new Date(dateAdded).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      dateAdded,
    };
  });
}

const STORAGE_USED_BYTES = 18.2 * 1024 * 1024;
const STORAGE_CAP_BYTES = 1 * 1024 * 1024 * 1024;
const STORAGE_LABEL = '18.2 MB / 1 GB used';

const HOVER_EASE = 'duration-150 ease-out';

export default function AssetLayout() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allAssets, setAllAssets] = useState<Asset[]>(() => buildMockAssets());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | AssetType>('all');
  const [sortKey, setSortKey] = useState<'date' | 'name' | 'size'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const dragDepthRef = useRef(0);
  const [dragFileActive, setDragFileActive] = useState(false);

  const filteredAssets = useMemo(() => {
    let list = allAssets.filter((a) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || a.name.toLowerCase().includes(q);
      const matchesType = filterType === 'all' || a.type === filterType;
      return matchesSearch && matchesType;
    });
    if (sortKey === 'date') list = [...list].sort((a, b) => b.dateAdded - a.dateAdded);
    if (sortKey === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortKey === 'size') list = [...list].sort((a, b) => b.sizeBytes - a.sizeBytes);
    return list;
  }, [allAssets, searchQuery, filterType, sortKey]);

  const storagePct = Math.min(100, (STORAGE_USED_BYTES / STORAGE_CAP_BYTES) * 100);

  const toggleSelect = useCallback((id: string, next?: boolean) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      const on = next ?? !n.has(id);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const handleUploadClick = () => fileInputRef.current?.click();

  const addPlaceholderFiles = useCallback((count: number) => {
    const start = allAssets.length;
    const types: AssetType[] = ['image', 'video', 'audio', 'document'];
    const next: Asset[] = [...allAssets];
    for (let i = 0; i < count; i++) {
      const type = types[(start + i) % 4];
      const ext = EXT_BY_TYPE[type][0];
      next.push({
        id: `upload-${Date.now()}-${i}`,
        name: `upload_${start + i + 1}.${ext.toLowerCase()}`,
        extLabel: ext,
        type,
        size: '0.2 MB',
        sizeBytes: 0.2 * 1024 * 1024,
        uploadedAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        dateAdded: Date.now(),
      });
    }
    setAllAssets(next);
  }, [allAssets]);

  const deleteAssets = useCallback((ids: Set<string>) => {
    setAllAssets((prev) => prev.filter((a) => !ids.has(a.id)));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  }, []);

  const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types?.includes('Files');

  const onDragEnter = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragFileActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragFileActive(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  };

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setDragFileActive(false);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    resetDragState();
    const n = e.dataTransfer.files?.length ?? 0;
    if (n > 0) addPlaceholderFiles(Math.min(n, 5));
  };

  useEffect(() => {
    const onDragEnd = () => resetDragState();
    window.addEventListener('dragend', onDragEnd);
    return () => window.removeEventListener('dragend', onDragEnd);
  }, [resetDragState]);

  const filterChips: { key: 'all' | AssetType; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'all', label: 'All', icon: LayoutGrid },
    { key: 'image', label: 'Images', icon: Image },
    { key: 'video', label: 'Video', icon: Video },
    { key: 'document', label: 'Documents', icon: FileText },
    { key: 'audio', label: 'Audio', icon: Music },
  ];

  const selectionCount = selectedIds.size;
  const showFileDropOverlay = allAssets.length > 0 && dragFileActive;

  return (
    <div
      className={`relative flex min-h-0 w-full flex-col font-[ui-sans-serif,system-ui,sans-serif] font-normal antialiased transition-colors ${HOVER_EASE}`}
      style={{ backgroundColor: BG, color: WHITE, minHeight: '100vh' }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          const n = e.target.files?.length ?? 0;
          if (n) addPlaceholderFiles(Math.min(n, 8));
          e.target.value = '';
        }}
      />

      {showFileDropOverlay && (
        <div
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center border-2 border-dashed"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)', borderColor: PURPLE }}
        >
          <p className="text-[15px] font-medium text-white">Drop files to upload</p>
        </div>
      )}

      {/* 1. Page header */}
      <header
        className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-5"
        style={{ borderColor: BORDER, backgroundColor: BG }}
      >
        <div className="min-w-0">
          <h1 className="m-0 text-[20px] font-medium leading-tight text-white">Asset library</h1>
          <p className="m-0 mt-0.5 text-[12px] font-normal" style={{ color: MUTED }}>
            Upload, search, and manage media files
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <div
            className="flex min-w-[200px] max-w-[280px] flex-col gap-1.5 rounded-lg border px-3 py-2"
            style={{ borderColor: BORDER, backgroundColor: SURFACE }}
          >
            <span className="text-[11px] font-medium" style={{ color: MUTED }}>
              {STORAGE_LABEL}
            </span>
            <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${storagePct}%`, backgroundColor: PURPLE }} />
            </div>
          </div>
          <button
            type="button"
            onClick={handleUploadClick}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: PURPLE }}
          >
            <Upload size={16} strokeWidth={2} aria-hidden />
            Upload files
          </button>
        </div>
      </header>

      {/* 2. Controls bar */}
      <div
        className="flex h-14 shrink-0 items-center gap-4 border-b px-5"
        style={{ borderColor: BORDER, backgroundColor: SURFACE }}
      >
        <div className="relative w-[320px] shrink-0">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: MUTED }}
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="box-border h-9 w-full rounded-lg border pl-9 pr-3 text-[13px] font-normal outline-none transition-colors"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderColor: BORDER_STRONG,
              color: WHITE,
            }}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
          {filterChips.map(({ key, label, icon: Icon }) => {
            const active = filterType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterType(key)}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors ${HOVER_EASE} ${
                  active ? '' : 'hover:bg-[rgba(255,255,255,0.05)]'
                }`}
                style={
                  active
                    ? { backgroundColor: PURPLE, borderColor: PURPLE, color: WHITE }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: BORDER_CHIP,
                        color: MUTED,
                      }
                }
              >
                <Icon size={16} strokeWidth={2} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
              className="h-[34px] cursor-pointer appearance-none rounded-lg border bg-transparent pl-3 pr-8 text-[13px] font-medium outline-none transition-colors"
              style={{ borderColor: BORDER, color: MUTED }}
            >
              <option value="date">Date added</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: MUTED }}
              aria-hidden
            />
          </div>
          <div className="flex rounded-lg border p-0.5" style={{ borderColor: BORDER }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className="flex size-[34px] items-center justify-center rounded-md transition-colors"
              style={{ backgroundColor: viewMode === 'grid' ? 'rgba(255,255,255,0.08)' : 'transparent', color: MUTED }}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid3x3 size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="flex size-[34px] items-center justify-center rounded-md transition-colors"
              style={{ backgroundColor: viewMode === 'list' ? 'rgba(255,255,255,0.08)' : 'transparent', color: MUTED }}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List size={16} strokeWidth={2} />
            </button>
          </div>
          <span className="whitespace-nowrap text-[12px] font-normal" style={{ color: MUTED }}>
            {filteredAssets.length} assets
          </span>
        </div>
      </div>

      {/* 3. Asset grid / list — scrollable */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(255,255,255,0.12)]"
        style={{ backgroundColor: BG }}
      >
        {allAssets.length === 0 && (
          <div
            className="mb-4 flex items-center gap-3 rounded-lg border px-4 py-3"
            style={{ borderColor: BORDER, backgroundColor: SURFACE }}
          >
            <Upload size={16} style={{ color: MUTED }} strokeWidth={2} aria-hidden />
            <p className="m-0 text-[13px] font-normal" style={{ color: MUTED }}>
              Drag files here or use <span className="font-medium text-white">Upload files</span> to add to your library.
            </p>
          </div>
        )}

        {allAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Upload size={48} strokeWidth={1.5} style={{ color: MUTED }} aria-hidden />
            <p className="mt-6 text-base font-medium text-white">No assets yet</p>
            <p className="mt-1 text-[13px] font-normal" style={{ color: MUTED }}>
              Upload your first file to get started
            </p>
            <button
              type="button"
              onClick={handleUploadClick}
              className="mt-6 flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-medium text-white"
              style={{ backgroundColor: PURPLE }}
            >
              <Upload size={16} strokeWidth={2} aria-hidden />
              Upload files
            </button>
          </div>
        ) : filteredAssets.length === 0 ? (
          <p className="py-16 text-center text-[13px] font-normal" style={{ color: MUTED }}>
            No assets match your search or filters.
          </p>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={selectedIds.has(asset.id)}
                onToggleSelect={() => toggleSelect(asset.id)}
                onDelete={(e) => {
                  e.stopPropagation();
                  deleteAssets(new Set([asset.id]));
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredAssets.map((asset) => (
              <AssetListRow
                key={asset.id}
                asset={asset}
                selected={selectedIds.has(asset.id)}
                onToggleSelect={() => toggleSelect(asset.id)}
                onDelete={() => deleteAssets(new Set([asset.id]))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Batch actions */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex h-[52px] items-center justify-between px-5 transition-transform duration-200 ease-out"
        style={{
          backgroundColor: SURFACE,
          borderTop: `1px solid ${PURPLE}`,
          transform: selectionCount > 0 ? 'translateY(0)' : 'translateY(100%)',
          pointerEvents: selectionCount > 0 ? 'auto' : 'none',
        }}
      >
        <span className="text-[13px] font-medium text-white">{selectionCount} items selected</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border px-3 text-[13px] font-medium transition-colors hover:border-[rgba(255,255,255,0.14)]"
            style={{ borderColor: BORDER, color: MUTED, backgroundColor: 'transparent' }}
          >
            Download selected
          </button>
          <button
            type="button"
            onClick={() => deleteAssets(selectedIds)}
            className="h-9 rounded-lg px-3 text-[13px] font-medium text-white"
            style={{ backgroundColor: DANGER }}
          >
            Delete selected
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  selected,
  onToggleSelect,
  onDelete,
}: {
  asset: Asset;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const Icon = TYPE_ICON[asset.type];
  const color = TYPE_COLOR[asset.type];

  return (
    <div
      className="group relative overflow-hidden rounded-xl border transition-colors duration-150 ease-out"
      style={{
        borderColor: selected ? PURPLE : BORDER,
        backgroundColor: CARD,
      }}
    >
      <div className="relative aspect-square" style={{ backgroundColor: THUMB_BG }}>
        <span
          className="absolute left-2 top-2 z-10 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-white"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          {asset.extLabel}
        </span>
        <label className="absolute right-2 top-2 z-10 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="size-4 cursor-pointer rounded accent-[#7C6FF7]"
            style={{ borderRadius: 4 }}
            onClick={(e) => e.stopPropagation()}
          />
        </label>
        <div className="flex h-full w-full items-center justify-center">
          <Icon size={32} strokeWidth={2} style={{ color }} aria-hidden />
        </div>
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-150 ease-out group-hover:pointer-events-auto group-hover:opacity-100"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-white transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.2)]"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            aria-label="Preview"
          >
            <Eye size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-white transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.2)]"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            aria-label="Download"
          >
            <Download size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex size-8 items-center justify-center rounded-full text-white transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.2)]"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            aria-label="Delete"
          >
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="box-border flex min-h-[44px] flex-col justify-center" style={{ backgroundColor: CARD, padding: '10px 12px' }}>
        <p className="m-0 truncate text-xs font-medium text-white">{asset.name}</p>
        <p className="m-0 truncate text-[11px] font-normal" style={{ color: MUTED }}>
          {asset.size} · {asset.uploadedAt}
        </p>
      </div>
    </div>
  );
}

function AssetListRow({
  asset,
  selected,
  onToggleSelect,
  onDelete,
}: {
  asset: Asset;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  const Icon = TYPE_ICON[asset.type];
  const color = TYPE_COLOR[asset.type];
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-2"
      style={{ borderColor: selected ? PURPLE : BORDER, backgroundColor: CARD }}
    >
      <input type="checkbox" checked={selected} onChange={onToggleSelect} className="size-4 shrink-0 rounded accent-[#7C6FF7]" />
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: THUMB_BG }}>
        <Icon size={32} strokeWidth={2} style={{ color }} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-xs font-medium text-white">{asset.name}</p>
        <p className="m-0 truncate text-[11px] font-normal" style={{ color: MUTED }}>
          {asset.size} · {asset.uploadedAt}
        </p>
      </div>
      <button type="button" className="shrink-0 p-2" style={{ color: MUTED }} aria-label="Download">
        <Download size={16} />
      </button>
      <button type="button" className="shrink-0 p-2" style={{ color: DANGER }} aria-label="Delete" onClick={onDelete}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

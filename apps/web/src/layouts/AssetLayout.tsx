import { useCallback, useMemo, useRef, useState } from 'react';
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
import { Button, PageHeader, PageShell, Surface } from '../components/ui';

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
  image: 'text-app-accent',
  video: 'text-amber-400',
  audio: 'text-emerald-400',
  document: 'text-blue-400',
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
      uploadedAt: new Date(dateAdded).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      dateAdded,
    };
  });
}

export default function AssetLayout() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allAssets, setAllAssets] = useState<Asset[]>(() => buildMockAssets());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | AssetType>('all');
  const [sortKey, setSortKey] = useState<'date' | 'name' | 'size'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

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

  const totalUsed = useMemo(
    () => allAssets.reduce((acc, asset) => acc + asset.sizeBytes, 0),
    [allAssets],
  );
  const storageLabel = `${(totalUsed / (1024 * 1024)).toFixed(1)} MB total`;

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

  const addPlaceholderFiles = useCallback(
    (count: number) => {
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
          uploadedAt: new Date().toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          dateAdded: Date.now(),
        });
      }
      setAllAssets(next);
    },
    [allAssets],
  );

  const deleteAssets = useCallback((ids: Set<string>) => {
    setAllAssets((prev) => prev.filter((a) => !ids.has(a.id)));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  }, []);

  const filterChips: { key: 'all' | AssetType; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'all', label: 'All', icon: LayoutGrid },
    { key: 'image', label: 'Images', icon: Image },
    { key: 'video', label: 'Video', icon: Video },
    { key: 'document', label: 'Documents', icon: FileText },
    { key: 'audio', label: 'Audio', icon: Music },
  ];

  const selectionCount = selectedIds.size;

  return (
    <PageShell wide className="app-main-canvas relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-app-accent/12 blur-[100px]" />
        <div className="absolute right-0 top-40 h-56 w-56 rounded-full bg-app-accent-2/10 blur-[90px]" />
        <div className="absolute bottom-0 left-1/3 h-40 w-96 max-w-[80%] rounded-full bg-app-accent-deep/15 blur-[100px]" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          const n = e.target.files?.length ?? 0;
          if (!n) return;
          setIsUploading(true);
          addPlaceholderFiles(Math.min(n, 8));
          setTimeout(() => setIsUploading(false), 550);
          e.target.value = '';
        }}
      />

      <PageHeader
        title="Asset library"
        accentWord="library"
        description="Upload, search, and manage media files."
        hint="Browse assets with the same workflow as content library."
      />

      <div className="animate-fade-in space-y-8">
        <Surface
          variant="glass"
          padding="lg"
          className="relative overflow-hidden rounded-app-xl border border-white/[0.08] bg-app-bg/35 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/25"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-accent/40 to-app-accent-2/25"
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={16}
                strokeWidth={2}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-accent/70"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="h-10 w-full rounded-app-md border border-white/10 bg-white/[0.04] pl-9 pr-3 text-[13px] text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-[border-color,box-shadow] placeholder:text-app-faint focus:border-app-accent/40 focus:ring-2 focus:ring-app-accent/15"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                  className="h-10 cursor-pointer appearance-none rounded-app-md border border-white/10 bg-white/[0.04] pl-3 pr-8 text-[13px] text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition-colors hover:border-white/16 focus:border-app-accent/40 focus:ring-2 focus:ring-app-accent/15"
                >
                  <option value="date">Date added</option>
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                </select>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-app-faint"
                />
              </div>
              <div className="inline-flex rounded-app-lg border border-white/10 bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex size-9 items-center justify-center rounded-app-md transition-all duration-200 ${
                    viewMode === 'grid'
                      ? 'bg-app-accent/15 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-app-accent/25'
                      : 'text-app-muted hover:bg-white/[0.06] hover:text-app-text'
                  }`}
                >
                  <Grid3x3 size={16} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex size-9 items-center justify-center rounded-app-md transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-app-accent/15 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-app-accent/25'
                      : 'text-app-muted hover:bg-white/[0.06] hover:text-app-text'
                  }`}
                >
                  <List size={16} strokeWidth={2} />
                </button>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={handleUploadClick}
                leftIcon={<Upload size={16} strokeWidth={2} />}
              >
                Upload files
              </Button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
            <div className="flex flex-wrap items-center gap-2">
              {filterChips.map(({ key, label, icon: Icon }) => {
                const active = filterType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterType(key)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all duration-200 ${
                      active
                        ? 'border-app-accent/45 bg-app-accent/12 text-app-accent shadow-[0_0_20px_-10px_rgba(147,124,248,0.45)] ring-1 ring-app-accent/20'
                        : 'border-white/[0.08] bg-white/[0.03] text-app-muted hover:border-white/14 hover:bg-white/[0.06] hover:text-app-text'
                    }`}
                  >
                    <Icon size={15} strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="text-[12px] font-medium tabular-nums text-app-muted">
              {filteredAssets.length} assets · {storageLabel}
            </div>
          </div>
        </Surface>

        {isUploading && (
          <div className="rounded-app-xl border border-app-accent/35 bg-app-accent/10 px-4 py-3 text-[13px] text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
            Upload complete. Assets were added to your library.
          </div>
        )}

        <Surface
          variant="glass"
          padding="lg"
          className="relative overflow-hidden rounded-app-xl border border-white/[0.08] bg-app-bg/30 shadow-app-lift backdrop-blur-xl supports-backdrop-filter:bg-app-bg/22"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent"
            aria-hidden
          />
          {allAssets.length === 0 && (
            <div className="mb-5 rounded-app-lg border border-dashed border-white/12 bg-white/[0.02] px-4 py-3 text-[13px] text-app-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              Drag files here or use <span className="font-medium text-app-text">Upload files</span>{' '}
              to add to your library.
            </div>
          )}

          {allAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-app-xl border border-app-accent/30 bg-app-accent/10 text-app-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Upload size={36} strokeWidth={1.5} />
              </div>
              <p className="mt-6 text-lg font-semibold tracking-tight text-app-text">
                No assets yet
              </p>
              <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-app-muted">
                Upload your first file to get started.
              </p>
              <Button
                type="button"
                variant="primary"
                className="mt-6"
                onClick={handleUploadClick}
                leftIcon={<Upload size={16} strokeWidth={2} />}
              >
                Upload files
              </Button>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="rounded-app-lg border border-dashed border-white/10 bg-white/[0.02] py-16 text-center text-[13px] text-app-muted">
              No assets match your search or filters.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-6">
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
            <div className="space-y-2.5">
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
        </Surface>

        <div
          className={`sticky bottom-0 z-20 mb-2 rounded-app-xl border border-app-accent/45 bg-app-bg/80 px-4 py-3.5 shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all duration-300 ease-out supports-backdrop-filter:bg-app-bg/65 md:px-5 ${
            selectionCount > 0
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-4 opacity-0'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] font-medium tabular-nums text-app-text">
              {selectionCount} items selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary">
                Download selected
              </Button>
              <button
                type="button"
                onClick={() => deleteAssets(selectedIds)}
                className="h-9 rounded-app-lg border border-red-400/35 bg-red-500/[0.12] px-3.5 text-[13px] font-medium text-red-200 shadow-[0_0_18px_-10px_rgba(248,113,113,0.35)] transition-colors hover:bg-red-500/20"
              >
                Delete selected
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
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
  const colorClass = TYPE_COLOR[asset.type];

  return (
    <div
      className={`group relative overflow-hidden rounded-app-xl border shadow-app-lift transition-all duration-200 ease-out motion-reduce:transition-none ${
        selected
          ? 'border-app-accent/50 bg-gradient-to-br from-app-accent/[0.12] to-white/[0.04] ring-1 ring-app-accent/25'
          : 'border-white/[0.08] bg-app-bg/40 backdrop-blur-sm hover:-translate-y-0.5 hover:border-app-accent/30 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)] motion-reduce:hover:translate-y-0'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-80"
        aria-hidden
      />
      <div className="relative aspect-4/3 overflow-hidden bg-gradient-to-br from-white/[0.06] via-app-bg-subtle to-app-bg">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(147,124,248,0.12),transparent)] opacity-40"
          aria-hidden
        />
        <span className="absolute left-2.5 top-2.5 z-10 rounded-app-md border border-white/10 bg-app-bg/70 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-app-text shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
          {asset.extLabel}
        </span>
        <label className="absolute right-2.5 top-2.5 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="size-4 cursor-pointer rounded border-white/20 bg-app-bg/80 accent-app-accent shadow-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </label>
        <div className="relative flex h-full w-full items-center justify-center">
          <div className="rounded-app-xl border border-white/[0.07] bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Icon size={34} strokeWidth={1.5} className={colorClass} />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-gradient-to-t from-app-bg via-app-bg/88 to-transparent opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            className="pointer-events-auto flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-md transition-colors duration-150 hover:border-white/25 hover:bg-white/20"
            aria-label="Preview"
          >
            <Eye size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="pointer-events-auto flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-md transition-colors duration-150 hover:border-white/25 hover:bg-white/20"
            aria-label="Download"
          >
            <Download size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="pointer-events-auto flex size-9 items-center justify-center rounded-full border border-red-400/30 bg-red-500/20 text-white shadow-lg backdrop-blur-md transition-colors duration-150 hover:bg-red-500/35"
            aria-label="Delete"
          >
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="border-t border-white/[0.07] bg-white/[0.02] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="m-0 truncate text-[13px] font-medium tracking-tight text-app-text">
          {asset.name}
        </p>
        <p className="m-0 mt-1 truncate text-[11px] tabular-nums text-app-muted">
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
  const colorClass = TYPE_COLOR[asset.type];
  return (
    <div
      className={`group flex items-center gap-3 rounded-app-xl border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 ${
        selected
          ? 'border-app-accent/45 bg-app-accent/10 ring-1 ring-app-accent/20'
          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="size-4 shrink-0 rounded border-white/15 bg-app-bg/80 accent-app-accent"
      />
      <div className="flex size-12 shrink-0 items-center justify-center rounded-app-lg border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <Icon size={26} strokeWidth={1.75} className={colorClass} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[13px] font-medium tracking-tight text-app-text">
          {asset.name}
        </p>
        <p className="m-0 truncate text-[11px] tabular-nums text-app-muted">
          {asset.size} · {asset.uploadedAt}
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-app-md p-2 text-app-muted transition-colors hover:bg-white/[0.06] hover:text-app-accent"
        aria-label="Download"
      >
        <Download size={16} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="shrink-0 rounded-app-md p-2 text-red-400/90 transition-colors hover:bg-red-500/15 hover:text-red-300"
        aria-label="Delete"
        onClick={onDelete}
      >
        <Trash2 size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

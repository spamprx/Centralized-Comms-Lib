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
    <PageShell wide>
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

      <div className="animate-fade-in space-y-6">
        <Surface className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="h-10 w-full rounded-app-md border border-app-border bg-app-bg/50 pl-9 pr-3 text-[13px] text-app-text outline-none transition-colors focus:border-app-accent"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                  className="h-10 appearance-none rounded-app-md border border-app-border bg-app-bg/40 pl-3 pr-8 text-[13px] text-app-muted outline-none transition-colors hover:border-app-border-strong focus:border-app-accent"
                >
                  <option value="date">Date added</option>
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-app-faint"
                />
              </div>
              <div className="inline-flex rounded-app-md border border-app-border p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`flex size-9 items-center justify-center rounded-app-sm transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-app-surface text-app-text'
                      : 'text-app-muted hover:bg-app-surface hover:text-app-text'
                  }`}
                >
                  <Grid3x3 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex size-9 items-center justify-center rounded-app-sm transition-colors ${
                    viewMode === 'list'
                      ? 'bg-app-surface text-app-text'
                      : 'text-app-muted hover:bg-app-surface hover:text-app-text'
                  }`}
                >
                  <List size={16} />
                </button>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={handleUploadClick}
                leftIcon={<Upload size={16} />}
              >
                Upload files
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {filterChips.map(({ key, label, icon: Icon }) => {
                const active = filterType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterType(key)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
                      active
                        ? 'border-app-accent bg-app-accent-muted text-app-accent-hover'
                        : 'border-app-border text-app-muted hover:border-app-border-strong hover:bg-app-surface hover:text-app-text'
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="text-[12px] text-app-muted">
              {filteredAssets.length} assets · {storageLabel}
            </div>
          </div>
        </Surface>

        {isUploading && (
          <div className="rounded-app-md border border-app-accent/40 bg-app-accent-muted px-4 py-2 text-[13px] text-app-accent-hover">
            Upload complete. Assets were added to your library.
          </div>
        )}

        <Surface>
          {allAssets.length === 0 && (
            <div className="mb-4 rounded-app-md border border-app-border bg-app-bg/40 px-4 py-3 text-[13px] text-app-muted">
              Drag files here or use <span className="text-app-text">Upload files</span> to add to
              your library.
            </div>
          )}

          {allAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Upload size={42} className="text-app-faint" />
              <p className="mt-5 text-base text-app-text">No assets yet</p>
              <p className="mt-1 text-[13px] text-app-muted">
                Upload your first file to get started.
              </p>
              <Button
                type="button"
                variant="primary"
                className="mt-5"
                onClick={handleUploadClick}
                leftIcon={<Upload size={16} />}
              >
                Upload files
              </Button>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-app-muted">
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
            <div className="space-y-2">
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
          className={`sticky bottom-0 z-20 rounded-app-md border bg-app-bg-subtle px-4 py-3 transition-all ${
            selectionCount > 0
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-4 opacity-0'
          }`}
          style={{ borderColor: 'rgba(124, 111, 247, 0.45)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-app-text">{selectionCount} items selected</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary">
                Download selected
              </Button>
              <button
                type="button"
                onClick={() => deleteAssets(selectedIds)}
                className="h-9 rounded-app-md border border-red-400/40 bg-red-500/10 px-3 text-[13px] text-red-300 transition-colors hover:bg-red-500/20"
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
      className={`group overflow-hidden rounded-app-xl border bg-app-surface/55 shadow-app-soft transition-all duration-200 ${
        selected
          ? 'border-app-accent/70'
          : 'border-app-border/90 hover:-translate-y-0.5 hover:border-app-accent/35'
      }`}
    >
      <div className="relative aspect-4/3 bg-app-bg-subtle">
        <span className="absolute left-2 top-2 z-10 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {asset.extLabel}
        </span>
        <label className="absolute right-2 top-2 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="size-4 cursor-pointer rounded accent-[#7C6FF7]"
            onClick={(e) => e.stopPropagation()}
          />
        </label>
        <div className="flex h-full w-full items-center justify-center">
          <Icon size={32} className={colorClass} />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/55 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors duration-150 hover:bg-white/25"
            aria-label="Preview"
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors duration-150 hover:bg-white/25"
            aria-label="Download"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors duration-150 hover:bg-white/25"
            aria-label="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="border-t border-app-border/70 px-4 py-3">
        <p className="m-0 truncate text-[13px] text-app-text">{asset.name}</p>
        <p className="m-0 mt-1 truncate text-[11px] text-app-muted">
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
      className={`flex items-center gap-3 rounded-app-md border px-3 py-2 transition-colors ${
        selected
          ? 'border-app-accent bg-app-accent-muted/30'
          : 'border-app-border bg-app-bg-subtle hover:border-app-border-strong'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="size-4 shrink-0 rounded accent-[#7C6FF7]"
      />
      <div className="flex size-12 shrink-0 items-center justify-center rounded-app-sm bg-app-bg">
        <Icon size={28} className={colorClass} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-xs text-app-text">{asset.name}</p>
        <p className="m-0 truncate text-[11px] text-app-muted">
          {asset.size} · {asset.uploadedAt}
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 p-2 text-app-muted hover:text-app-text"
        aria-label="Download"
      >
        <Download size={16} />
      </button>
      <button
        type="button"
        className="shrink-0 p-2 text-red-400 hover:text-red-300"
        aria-label="Delete"
        onClick={onDelete}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

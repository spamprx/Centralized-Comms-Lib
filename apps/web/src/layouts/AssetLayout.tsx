import { useState } from 'react';
import { Upload, Search, Image, FileText, Video, Music, X, Download, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PageShell } from '../components/ui/PageShell';
import { Surface } from '../components/ui/Surface';

const mockAssets = Array.from({ length: 15 }, (_, i) => ({
  id: String(i + 1),
  name: `Asset_${i + 1}.${['png', 'jpg', 'pdf', 'mp4', 'mp3'][i % 5]}`,
  type: ['image', 'image', 'document', 'video', 'audio'][i % 5] as 'image' | 'document' | 'video' | 'audio',
  size: `${(Math.random() * 10 + 1).toFixed(1)} MB`,
  uploadedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
  url: '',
}));

export default function AssetLayout() {
  const [assets] = useState(mockAssets);
  const [selectedAsset, setSelectedAsset] = useState<typeof mockAssets[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || asset.type === filterType;
    return matchesSearch && matchesType;
  });

  const typeIcons = {
    image: Image,
    document: FileText,
    video: Video,
    audio: Music,
  };

  const typeColors = {
    image: '#8b5cf6',
    document: '#06b6d4',
    video: '#f59e0b',
    audio: '#10b981',
  };

  return (
    <PageShell wide className="flex min-h-0 flex-1 flex-col pb-6">
      <PageHeader
        title="Asset library"
        accentWord="library"
        description="Upload, search, and manage media and files for your content."
      />

      <Surface variant="glass" padding="md" className="mb-6">
        <div className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-app-xl border-2 border-dashed border-app-accent/35 bg-app-accent-muted/30 p-6 transition-colors hover:border-app-accent/55 hover:bg-app-accent/10 sm:flex-row sm:justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-app-lg bg-app-accent-muted text-app-accent">
            <Upload size={24} aria-hidden />
          </div>
          <div className="text-center sm:text-left">
            <p className="m-0 text-sm font-medium text-app-text">Drop files here or click to upload</p>
            <p className="mt-1 mb-0 text-xs text-app-faint">
              Images, video, documents, audio — up to 25MB
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets…"
              className="box-border w-full rounded-app-lg border border-app-border bg-app-bg-subtle py-2.5 pl-10 pr-3 text-[13px] text-app-text outline-none focus:border-app-accent/40"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="cursor-pointer rounded-app-lg border border-app-border bg-app-bg-subtle px-3 py-2.5 text-[13px] text-app-text"
          >
            <option value="all">All types</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
          </select>
        </div>
      </Surface>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-app-xl border border-app-border/80 bg-app-bg/40 lg:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {filteredAssets.map((asset) => {
              const Icon = typeIcons[asset.type];
              return (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`rounded-app-lg p-4 cursor-pointer transition-all duration-200 ${
                    selectedAsset?.id === asset.id
                      ? 'bg-app-accent-muted border border-app-accent/40'
                      : 'bg-app-surface border border-app-border'
                  }`}
                >
                  <div
                    className="aspect-square rounded-lg flex items-center justify-center mb-3"
                    style={{ background: `${typeColors[asset.type]}22` }}
                  >
                    <Icon size={32} color={typeColors[asset.type]} />
                  </div>
                  <p className="text-xs font-medium text-app-text mb-1 overflow-hidden text-ellipsis whitespace-nowrap">{asset.name}</p>
                  <p className="text-[10px] text-app-faint m-0">{asset.size} • {asset.uploadedAt}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Asset Detail Drawer */}
        {selectedAsset && (
          <Surface variant="glass" padding="md" className="w-full shrink-0 overflow-y-auto border-t border-app-border/80 lg:w-80 lg:border-l lg:border-t-0">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="m-0 text-base font-semibold text-app-text">Asset details</h2>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="cursor-pointer rounded-app-md border-none bg-transparent p-1 text-app-faint hover:bg-app-elevated hover:text-app-text"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview */}
            <div
              className="aspect-square rounded-app-lg flex items-center justify-center mb-5"
              style={{ background: `${typeColors[selectedAsset.type]}22` }}
            >
              {(() => {
                const Icon = typeIcons[selectedAsset.type];
                return <Icon size={64} color={typeColors[selectedAsset.type]} />;
              })()}
            </div>

            {/* Details */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-app-faint block mb-1">Name</label>
                <p className="text-[13px] text-app-text m-0">{selectedAsset.name}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-app-faint block mb-1">Type</label>
                <p className="text-[13px] text-app-text m-0 capitalize">{selectedAsset.type}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-app-faint block mb-1">Size</label>
                <p className="text-[13px] text-app-text m-0">{selectedAsset.size}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-app-faint block mb-1">Uploaded</label>
                <p className="text-[13px] text-app-text m-0">{selectedAsset.uploadedAt}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-app-md border-none bg-gradient-to-br from-app-accent to-app-accent-deep px-4 py-2.5 text-[13px] font-medium text-white shadow-app-soft"
              >
                <Download size={16} /> Download
              </button>
              <button
                type="button"
                className="flex cursor-pointer items-center justify-center rounded-app-md border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-red-300 hover:bg-red-500/15"
                aria-label="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </Surface>
        )}
      </div>
    </PageShell>
  );
}

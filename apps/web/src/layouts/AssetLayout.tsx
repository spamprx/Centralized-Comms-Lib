import { useState } from 'react';
import { Upload, Search, Image, FileText, Video, Music, X, Download, Trash2 } from 'lucide-react';

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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <h1 className="text-2xl font-bold text-[#e2e4f0] mb-4">Asset Management</h1>

        {/* Upload Dropzone */}
        <div className="p-6 bg-violet-500/5 border-2 border-dashed border-violet-500/30 rounded-xl mb-4 flex items-center justify-center gap-3 cursor-pointer hover:bg-violet-500/10 hover:border-violet-500/50 transition-colors">
          <Upload size={24} color="#a78bfa" />
          <div className="text-center">
            <p className="text-sm font-medium text-[#e2e4f0] m-0">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-[#555870] mt-1 mb-0">
              Supports: Images, Videos, Documents, Audio (Max 25MB)
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555870]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="w-full py-2.5 pr-3 pl-10 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] outline-none box-border"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#e2e4f0] text-[13px] cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Asset Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {filteredAssets.map((asset) => {
              const Icon = typeIcons[asset.type];
              return (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`rounded-[10px] p-4 cursor-pointer transition-all duration-200 ${
                    selectedAsset?.id === asset.id
                      ? 'bg-violet-500/15 border border-violet-500/40'
                      : 'bg-white/[0.03] border border-white/[0.07]'
                  }`}
                >
                  <div
                    className="aspect-square rounded-lg flex items-center justify-center mb-3"
                    style={{ background: `${typeColors[asset.type]}22` }}
                  >
                    <Icon size={32} color={typeColors[asset.type]} />
                  </div>
                  <p className="text-xs font-medium text-[#e2e4f0] mb-1 overflow-hidden text-ellipsis whitespace-nowrap">{asset.name}</p>
                  <p className="text-[10px] text-[#555870] m-0">{asset.size} • {asset.uploadedAt}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Asset Detail Drawer */}
        {selectedAsset && (
          <div className="w-80 bg-white/[0.03] border-l border-white/5 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-semibold text-[#e2e4f0] m-0">Asset Details</h2>
              <button
                onClick={() => setSelectedAsset(null)}
                className="bg-transparent border-none text-[#555870] cursor-pointer p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview */}
            <div
              className="aspect-square rounded-[10px] flex items-center justify-center mb-5"
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
                <label className="text-[11px] font-semibold text-[#555870] block mb-1">Name</label>
                <p className="text-[13px] text-[#e2e4f0] m-0">{selectedAsset.name}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#555870] block mb-1">Type</label>
                <p className="text-[13px] text-[#e2e4f0] m-0 capitalize">{selectedAsset.type}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#555870] block mb-1">Size</label>
                <p className="text-[13px] text-[#e2e4f0] m-0">{selectedAsset.size}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#555870] block mb-1">Uploaded</label>
                <p className="text-[13px] text-[#e2e4f0] m-0">{selectedAsset.uploadedAt}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-6">
              <button className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-br from-violet-500 to-cyan-500 border-none rounded-md text-white text-[13px] font-medium cursor-pointer">
                <Download size={16} /> Download
              </button>
              <button className="flex items-center justify-center px-3 py-2.5 bg-red-500/15 border border-red-500/30 rounded-md text-red-400 cursor-pointer">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

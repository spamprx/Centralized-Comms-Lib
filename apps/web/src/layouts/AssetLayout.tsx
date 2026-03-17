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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{ padding: 24, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0', margin: '0 0 16px' }}>Asset Management</h1>
        
        {/* Upload Dropzone */}
        <div style={{
          padding: 24,
          background: 'rgba(139, 92, 246, 0.05)',
          border: '2px dashed rgba(139, 92, 246, 0.3)',
          borderRadius: 12,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
        }}
        >
          <Upload size={24} color="#a78bfa" />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#e2e4f0', margin: 0 }}>
              Drop files here or click to upload
            </p>
            <p style={{ fontSize: 12, color: '#555870', margin: '4px 0 0' }}>
              Supports: Images, Videos, Documents, Audio (Max 25MB)
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#555870',
            }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#e2e4f0',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#e2e4f0',
              fontSize: 13,
              cursor: 'pointer',
            }}
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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Asset Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16,
          }}>
            {filteredAssets.map((asset) => {
              const Icon = typeIcons[asset.type];
              return (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  style={{
                    background: selectedAsset?.id === asset.id
                      ? 'rgba(139, 92, 246, 0.15)'
                      : 'rgba(255,255,255,0.03)',
                    border: selectedAsset?.id === asset.id
                      ? '1px solid rgba(139, 92, 246, 0.4)'
                      : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 10,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    aspectRatio: '1',
                    background: `${typeColors[asset.type]}22`,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}>
                    <Icon size={32} color={typeColors[asset.type]} />
                  </div>
                  <p style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#e2e4f0',
                    margin: '0 0 4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{asset.name}</p>
                  <p style={{ fontSize: 10, color: '#555870', margin: 0 }}>{asset.size} • {asset.uploadedAt}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Asset Detail Drawer */}
        {selectedAsset && (
          <div style={{
            width: 320,
            background: 'rgba(255,255,255,0.03)',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            padding: 24,
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4f0', margin: 0 }}>Asset Details</h2>
              <button
                onClick={() => setSelectedAsset(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#555870',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview */}
            <div style={{
              aspectRatio: '1',
              background: `${typeColors[selectedAsset.type]}22`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              {(() => {
                const Icon = typeIcons[selectedAsset.type];
                return <Icon size={64} color={typeColors[selectedAsset.type]} />;
              })()}
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#555870', display: 'block', marginBottom: 4 }}>Name</label>
                <p style={{ fontSize: 13, color: '#e2e4f0', margin: 0 }}>{selectedAsset.name}</p>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#555870', display: 'block', marginBottom: 4 }}>Type</label>
                <p style={{ fontSize: 13, color: '#e2e4f0', margin: 0, textTransform: 'capitalize' }}>{selectedAsset.type}</p>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#555870', display: 'block', marginBottom: 4 }}>Size</label>
                <p style={{ fontSize: 13, color: '#e2e4f0', margin: 0 }}>{selectedAsset.size}</p>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#555870', display: 'block', marginBottom: 4 }}>Uploaded</label>
                <p style={{ fontSize: 13, color: '#e2e4f0', margin: 0 }}>{selectedAsset.uploadedAt}</p>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}>
                <Download size={16} /> Download
              </button>
              <button style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 6,
                color: '#f87171',
                cursor: 'pointer',
              }}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

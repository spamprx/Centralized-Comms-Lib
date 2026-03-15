import { useState } from 'react';
import { Monitor, Smartphone, Tablet, ChevronLeft, Share2, Download } from 'lucide-react';

const channels = [
  { id: 'web', name: 'Web', icon: Monitor },
  { id: 'mobile', name: 'Mobile', icon: Smartphone },
  { id: 'tablet', name: 'Tablet', icon: Tablet },
];

const mockContent = {
  title: 'Getting Started with Our Platform',
  sections: [
    { type: 'heading', content: 'Welcome to the Platform' },
    { type: 'paragraph', content: 'This is a preview of your content. You can see how it will appear across different channels and devices.' },
    { type: 'list', items: ['Easy to use interface', 'Powerful features', 'Great support'] },
    { type: 'paragraph', content: 'Use the channel switcher above to see how your content adapts to different screen sizes and formats.' },
  ],
};

export default function PreviewLayout() {
  const [activeChannel, setActiveChannel] = useState('web');

  const getPreviewWidth = () => {
    switch (activeChannel) {
      case 'mobile': return 375;
      case 'tablet': return 768;
      default: return '100%';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0b0d14' }}>
      {/* Topbar */}
      <div style={{
        padding: '12px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{
            background: 'none',
            border: 'none',
            color: '#555870',
            cursor: 'pointer',
            padding: 8,
          }}>
            <ChevronLeft size={20} />
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#e2e4f0', margin: 0 }}>Preview Mode</h1>
          <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 8px' }}>|</span>
          <span style={{ fontSize: 13, color: '#8b8fa8' }}>{mockContent.title}</span>
        </div>

        {/* Channel Switcher */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 4 }}>
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                background: activeChannel === channel.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                color: activeChannel === channel.id ? '#a78bfa' : '#555870',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <channel.icon size={14} />
              {channel.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            color: '#8b8fa8',
            fontSize: 12,
            cursor: 'pointer',
          }}>
            <Download size={14} /> Export
          </button>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>

      {/* Preview Canvas */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 40,
        display: 'flex',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: getPreviewWidth(),
          maxWidth: '100%',
          background: '#fff',
          borderRadius: activeChannel === 'web' ? 0 : 24,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}>
          {/* Preview Header */}
          <div style={{
            padding: '24px 32px',
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            color: '#fff',
          }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>{mockContent.title}</h1>
            <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>Last updated: March 11, 2025</p>
          </div>

          {/* Preview Content */}
          <div style={{ padding: 32 }}>
            {mockContent.sections.map((section, index) => {
              if (section.type === 'heading') {
                return (
                  <h2 key={index} style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: '#1a1d2e',
                    margin: '0 0 16px',
                  }}>{section.content}</h2>
                );
              }
              if (section.type === 'paragraph') {
                return (
                  <p key={index} style={{
                    fontSize: 15,
                    color: '#4b5563',
                    lineHeight: 1.7,
                    margin: '0 0 16px',
                  }}>{section.content}</p>
                );
              }
              if (section.type === 'list') {
                return (
                  <ul key={index} style={{
                    margin: '0 0 16px 20px',
                    padding: 0,
                  }}>
                    {section.items?.map((item, i) => (
                      <li key={i} style={{
                        fontSize: 15,
                        color: '#4b5563',
                        lineHeight: 1.7,
                        marginBottom: 8,
                      }}>{item}</li>
                    ))}
                  </ul>
                );
              }
              return null;
            })}
          </div>

          {/* Preview Footer */}
          <div style={{
            padding: '20px 32px',
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
          }}>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              © 2025 CommsLib. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Conditional Sections Panel */}
      <div style={{
        width: 280,
        background: 'rgba(255,255,255,0.03)',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        padding: 20,
        position: 'absolute',
        right: 0,
        top: 57,
        bottom: 0,
        overflowY: 'auto',
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: '#e2e4f0', margin: '0 0 16px' }}>
          Conditional Sections
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { name: 'Introduction', enabled: true },
            { name: 'Getting Started', enabled: true },
            { name: 'Advanced Features', enabled: false },
            { name: 'FAQ', enabled: true },
            { name: 'Related Content', enabled: false },
          ].map((section) => (
            <label
              key={section.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 12, color: '#8b8fa8' }}>{section.name}</span>
              <input
                type="checkbox"
                defaultChecked={section.enabled}
                style={{ accentColor: '#8b5cf6' }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

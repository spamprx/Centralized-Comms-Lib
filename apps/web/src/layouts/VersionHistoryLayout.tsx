import { useState } from 'react';
import { GitCompare, RotateCcw, Download, Eye, Clock, FileText } from 'lucide-react';

const mockVersions = [
  {
    id: '1',
    version: 'v1.0',
    date: '2025-03-01T10:00:00',
    author: 'Alice Johnson',
    changes: 'Initial document creation',
    status: 'published',
    content: `# Getting Started Guide

## Introduction
Welcome to our platform. This is the initial version of the guide.

## Basic Features
- Feature A: Description here
- Feature B: Description here`,
  },
  {
    id: '2',
    version: 'v1.1',
    date: '2025-03-03T14:30:00',
    author: 'Bob Smith',
    changes: 'Added screenshots and examples',
    status: 'published',
    content: `# Getting Started Guide

## Introduction
Welcome to our platform. This is the initial version of the guide.

## Basic Features
- Feature A: Description here
- Feature B: Description here

## Screenshots
[Screenshot 1: Dashboard view]
[Screenshot 2: Settings panel]`,
  },
  {
    id: '3',
    version: 'v1.2',
    date: '2025-03-05T09:15:00',
    author: 'Alice Johnson',
    changes: 'Updated feature descriptions',
    status: 'published',
    content: `# Getting Started Guide

## Introduction
Welcome to our platform! This comprehensive guide will help you get started.

## Basic Features
- Feature A: Enhanced description with more details
- Feature B: Updated with new capabilities
- Feature C: New feature added

## Screenshots
[Screenshot 1: Dashboard view]
[Screenshot 2: Settings panel]`,
  },
  {
    id: '4',
    version: 'v2.0',
    date: '2025-03-08T16:45:00',
    author: 'Carol Williams',
    changes: 'Major revision with new sections',
    status: 'current',
    content: `# Getting Started Guide v2.0

## Introduction
Welcome to our platform! This comprehensive guide will help you get started quickly.

## Basic Features
- Feature A: Enhanced description with more details
- Feature B: Updated with new capabilities
- Feature C: New feature added

## Advanced Features
- Feature X: Power user capabilities
- Feature Y: Automation tools
- Feature Z: Integration options

## Screenshots
[Screenshot 1: Dashboard view]
[Screenshot 2: Settings panel]
[Screenshot 3: Advanced settings]

## Troubleshooting
Common issues and solutions...`,
  },
];

export default function VersionHistoryLayout() {
  const [selectedVersion, setSelectedVersion] = useState(mockVersions[3]);
  const [compareVersion, setCompareVersion] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const addedLines = (selectedVersion.content.match(/\+.*|##.*|###.*/g) || []).length;
  const removedLines = 0;

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e4f0', margin: '0 0 4px' }}>Version History</h1>
        <p style={{ fontSize: 13, color: '#555870', margin: 0 }}>
          Track changes and restore previous versions
        </p>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        {/* Version Timeline List */}
        <div style={{
          width: 320,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: '0 0 4px' }}>All Versions</h2>
            <p style={{ fontSize: 11, color: '#555870', margin: 0 }}>{mockVersions.length} versions total</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {mockVersions.map((version) => (
              <div
                key={version.id}
                onClick={() => {
                  setSelectedVersion(version);
                  setShowDiff(false);
                }}
                style={{
                  padding: 14,
                  background: selectedVersion.id === version.id ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                  border: selectedVersion.id === version.id ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                  borderRadius: 8,
                  marginBottom: 8,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: selectedVersion.id === version.id ? '#a78bfa' : '#e2e4f0',
                  }}>{version.version}</span>
                  {version.status === 'current' && (
                    <span style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      borderRadius: 4,
                      color: '#10b981',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>Current</span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: '#8b8fa8', margin: '0 0 6px', lineHeight: 1.4 }}>{version.changes}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#555870' }}>
                  <Clock size={10} />
                  {new Date(version.date).toLocaleDateString()}
                </div>
                <div style={{ fontSize: 10, color: '#555870', marginTop: 4 }}>by {version.author}</div>

                {/* Compare checkbox */}
                {showDiff && selectedVersion.id !== version.id && (
                  <label
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      color: compareVersion === version.id ? '#a78bfa' : '#555870',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={compareVersion === version.id}
                      onChange={(e) => setCompareVersion(e.target.checked ? version.id : null)}
                      style={{ accentColor: '#8b5cf6' }}
                    />
                    Compare
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Diff View Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileText size={18} color="#8b5cf6" />
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: '0 0 2px' }}>
                  {selectedVersion.version} - {selectedVersion.changes}
                </h2>
                <p style={{ fontSize: 11, color: '#555870', margin: 0 }}>
                  Last modified {new Date(selectedVersion.date).toLocaleString()}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDiff(!showDiff)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: showDiff ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: 6,
                  color: showDiff ? '#a78bfa' : '#8b8fa8',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <GitCompare size={14} /> {showDiff ? 'Hide Diff' : 'Compare'}
              </button>
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
                <Eye size={14} /> Preview
              </button>
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
              {selectedVersion.status !== 'current' && (
                <button style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 6,
                  color: '#10b981',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                onClick={() => alert('Restore functionality requires backend integration')}
                >
                  <RotateCcw size={14} /> Restore
                </button>
              )}
            </div>
          </div>

          {/* Content/Diff View */}
          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'auto',
          }}>
            {showDiff && compareVersion ? (
              /* Diff View */
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e4f0', margin: '0 0 16px' }}>
                  Comparing {selectedVersion.version} with {mockVersions.find(v => v.id === compareVersion)?.version}
                </h3>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <div style={{ flex: 1, padding: 12, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 6 }}>
                    <span style={{ fontSize: 12, color: '#10b981' }}>+{addedLines} lines added</span>
                  </div>
                  <div style={{ flex: 1, padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6 }}>
                    <span style={{ fontSize: 12, color: '#f87171' }}>-{removedLines} lines removed</span>
                  </div>
                </div>
                <pre style={{
                  fontSize: 12,
                  color: '#c4c7d9',
                  lineHeight: 1.6,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  background: '#1a1d2e',
                  padding: 20,
                  borderRadius: 8,
                }}>
{selectedVersion.content.split('\n').map((line, i) => {
  const compareContent = mockVersions.find(v => v.id === compareVersion)?.content || '';
  const isAdded = !compareContent.includes(line) && line.trim();

  if (isAdded) {
    return <div key={i} style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px' }}><span style={{ color: '#10b981', marginRight: 8 }}>+</span>{line}</div>;
  }
  return <div key={i} style={{ padding: '2px 8px' }}>{line || ' '}</div>;
})}
                </pre>
              </div>
            ) : (
              /* Regular Content View */
              <div style={{ padding: 20 }}>
                <pre style={{
                  fontSize: 13,
                  color: '#c4c7d9',
                  lineHeight: 1.8,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                }}>
{selectedVersion.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

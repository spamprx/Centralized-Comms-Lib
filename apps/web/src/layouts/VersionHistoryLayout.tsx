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
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e2e4f0] mb-1">Version History</h1>
        <p className="text-[13px] text-[#555870] m-0">
          Track changes and restore previous versions
        </p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Version Timeline List */}
        <div className="w-80 bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-[#e2e4f0] mb-1">All Versions</h2>
            <p className="text-[11px] text-[#555870] m-0">{mockVersions.length} versions total</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {mockVersions.map((version) => (
              <div
                key={version.id}
                onClick={() => {
                  setSelectedVersion(version);
                  setShowDiff(false);
                }}
                className={`p-3.5 rounded-lg mb-2 cursor-pointer relative ${
                  selectedVersion.id === version.id
                    ? 'bg-violet-500/15 border border-violet-500/30'
                    : 'bg-white/[0.02] border border-transparent'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-xs font-bold ${selectedVersion.id === version.id ? 'text-violet-400' : 'text-[#e2e4f0]'}`}>
                    {version.version}
                  </span>
                  {version.status === 'current' && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 rounded text-emerald-500 font-semibold uppercase">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8b8fa8] mb-1.5 leading-snug">{version.changes}</p>
                <div className="flex items-center gap-2 text-[10px] text-[#555870]">
                  <Clock size={10} />
                  {new Date(version.date).toLocaleDateString()}
                </div>
                <div className="text-[10px] text-[#555870] mt-1">by {version.author}</div>

                {/* Compare checkbox */}
                {showDiff && selectedVersion.id !== version.id && (
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-3.5 right-3.5 flex items-center gap-1 text-[10px] cursor-pointer ${
                      compareVersion === version.id ? 'text-violet-400' : 'text-[#555870]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={compareVersion === version.id}
                      onChange={(e) => setCompareVersion(e.target.checked ? version.id : null)}
                      className="accent-violet-500"
                    />
                    Compare
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Diff View Panel */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Toolbar */}
          <div className="flex justify-between items-center p-4 bg-white/[0.03] border border-white/[0.07] rounded-xl">
            <div className="flex items-center gap-3">
              <FileText size={18} color="#8b5cf6" />
              <div>
                <h2 className="text-sm font-semibold text-[#e2e4f0] mb-0.5">
                  {selectedVersion.version} - {selectedVersion.changes}
                </h2>
                <p className="text-[11px] text-[#555870] m-0">
                  Last modified {new Date(selectedVersion.date).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiff(!showDiff)}
                className={`flex items-center gap-1.5 px-3.5 py-2 border-none rounded-md text-xs cursor-pointer ${
                  showDiff ? 'bg-violet-500/15 text-violet-400' : 'bg-white/5 text-[#8b8fa8]'
                }`}
              >
                <GitCompare size={14} /> {showDiff ? 'Hide Diff' : 'Compare'}
              </button>
              <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 border border-white/10 rounded-md text-[#8b8fa8] text-xs cursor-pointer">
                <Eye size={14} /> Preview
              </button>
              <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 border border-white/10 rounded-md text-[#8b8fa8] text-xs cursor-pointer">
                <Download size={14} /> Export
              </button>
              {selectedVersion.status !== 'current' && (
                <button
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/15 border border-emerald-500/30 rounded-md text-emerald-500 text-xs font-medium cursor-pointer"
                  onClick={() => alert('Restore functionality requires backend integration')}
                >
                  <RotateCcw size={14} /> Restore
                </button>
              )}
            </div>
          </div>

          {/* Content/Diff View */}
          <div className="flex-1 bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-auto">
            {showDiff && compareVersion ? (
              /* Diff View */
              <div className="p-5">
                <h3 className="text-sm font-semibold text-[#e2e4f0] mb-4">
                  Comparing {selectedVersion.version} with {mockVersions.find(v => v.id === compareVersion)?.version}
                </h3>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 p-3 bg-emerald-500/10 rounded-md">
                    <span className="text-xs text-emerald-500">+{addedLines} lines added</span>
                  </div>
                  <div className="flex-1 p-3 bg-red-500/10 rounded-md">
                    <span className="text-xs text-red-400">-{removedLines} lines removed</span>
                  </div>
                </div>
                <pre className="text-xs text-[#c4c7d9] leading-relaxed m-0 whitespace-pre-wrap break-words bg-[#1a1d2e] p-5 rounded-lg">
{selectedVersion.content.split('\n').map((line, i) => {
  const compareContent = mockVersions.find(v => v.id === compareVersion)?.content || '';
  const isAdded = !compareContent.includes(line) && line.trim();

  if (isAdded) {
    return <div key={i} className="bg-emerald-500/15 px-2 py-0.5"><span className="text-emerald-500 mr-2">+</span>{line}</div>;
  }
  return <div key={i} className="px-2 py-0.5">{line || ' '}</div>;
})}
                </pre>
              </div>
            ) : (
              /* Regular Content View */
              <div className="p-5">
                <pre className="text-[13px] text-[#c4c7d9] leading-relaxed m-0 whitespace-pre-wrap break-words">
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

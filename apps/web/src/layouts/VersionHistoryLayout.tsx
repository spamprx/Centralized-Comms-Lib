import { useState } from 'react';
import { GitCompare, RotateCcw, Download, Eye, Clock, FileText } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PageShell } from '../components/ui/PageShell';
import { Surface } from '../components/ui/Surface';

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
    <PageShell wide className="flex min-h-0 flex-1 flex-col pb-10">
      <PageHeader
        title="Version history"
        accentWord="history"
        description="Track changes across revisions, compare snapshots, and restore when needed."
      />

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
        {/* Timeline */}
        <Surface variant="glass" padding="none" className="flex max-h-[min(70vh,640px)] flex-col overflow-hidden lg:max-h-none">
          <div className="border-b border-app-border/80 px-5 py-4">
            <h2 className="m-0 text-sm font-semibold text-app-text">All versions</h2>
            <p className="mt-1 m-0 text-[11px] text-app-faint">{mockVersions.length} revisions</p>
          </div>
          <div className="relative flex-1 overflow-y-auto p-3">
            <div
              className="pointer-events-none absolute bottom-4 left-[1.35rem] top-4 w-px bg-gradient-to-b from-app-accent/45 via-app-border to-transparent"
              aria-hidden
            />
            <div className="relative flex flex-col gap-2">
              {mockVersions.map((version) => {
                const active = selectedVersion.id === version.id;
                return (
                  <button
                    type="button"
                    key={version.id}
                    onClick={() => {
                      setSelectedVersion(version);
                      setShowDiff(false);
                    }}
                    className={`relative rounded-app-lg border p-3.5 pl-10 text-left transition-all duration-200 ${
                      active
                        ? 'border-app-accent/40 bg-app-accent-muted shadow-app-soft'
                        : 'border-app-border/60 bg-app-bg/35 hover:border-app-border-strong hover:bg-app-elevated'
                    }`}
                  >
                    <span
                      className={`absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 ${
                        active
                          ? 'border-app-accent bg-app-accent shadow-[0_0_12px_rgba(147,124,248,0.45)]'
                          : 'border-app-border-strong bg-app-bg-subtle'
                      }`}
                      aria-hidden
                    />
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold ${active ? 'text-app-accent' : 'text-app-text'}`}>
                        {version.version}
                      </span>
                      {version.status === 'current' && (
                        <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-300">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="mb-1.5 text-[11px] leading-snug text-app-muted">{version.changes}</p>
                    <div className="flex items-center gap-2 text-[10px] text-app-faint">
                      <Clock size={10} className="shrink-0 opacity-80" />
                      {new Date(version.date).toLocaleDateString()}
                    </div>
                    <div className="mt-1 text-[10px] text-app-faint">by {version.author}</div>

                    {showDiff && selectedVersion.id !== version.id && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute right-3 top-3 flex cursor-pointer items-center gap-1 text-[10px] ${
                          compareVersion === version.id ? 'text-app-accent' : 'text-app-faint'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={compareVersion === version.id}
                          onChange={(e) => setCompareVersion(e.target.checked ? version.id : null)}
                          className="accent-app-accent"
                        />
                        Compare
                      </label>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Surface>

        {/* Main column */}
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <Surface variant="default" padding="md" className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-app-lg bg-app-accent-muted text-app-accent">
                <FileText size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <h2 className="m-0 text-sm font-semibold text-app-text">
                  {selectedVersion.version} — {selectedVersion.changes}
                </h2>
                <p className="mt-0.5 m-0 text-[11px] text-app-faint">
                  Last modified {new Date(selectedVersion.date).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDiff(!showDiff)}
                className={`flex items-center gap-1.5 rounded-app-md px-3.5 py-2 text-xs transition-colors ${
                  showDiff
                    ? 'bg-app-accent-muted text-app-accent shadow-[0_0_0_1px_rgba(147,124,248,0.2)]'
                    : 'border border-app-border/80 bg-app-bg/40 text-app-muted hover:border-app-accent/25 hover:text-app-text'
                }`}
              >
                <GitCompare size={14} /> {showDiff ? 'Hide diff' : 'Compare'}
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-app-md border border-app-border/80 bg-app-bg/40 px-3.5 py-2 text-xs text-app-muted hover:border-app-accent/25 hover:text-app-text"
              >
                <Eye size={14} /> Preview
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-app-md border border-app-border/80 bg-app-bg/40 px-3.5 py-2 text-xs text-app-muted hover:border-app-accent/25 hover:text-app-text"
              >
                <Download size={14} /> Export
              </button>
              {selectedVersion.status !== 'current' && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-app-md border border-emerald-400/35 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/15"
                  onClick={() => alert('Restore functionality requires backend integration')}
                >
                  <RotateCcw size={14} /> Restore
                </button>
              )}
            </div>
          </Surface>

          <Surface variant="muted" padding="md" className="min-h-[280px] flex-1 overflow-auto lg:min-h-0">
            {showDiff && compareVersion ? (
              <div>
                <h3 className="mb-4 text-sm font-semibold text-app-text">
                  Comparing {selectedVersion.version} with{' '}
                  {mockVersions.find((v) => v.id === compareVersion)?.version}
                </h3>
                <div className="mb-4 flex gap-4">
                  <div className="flex-1 rounded-app-md bg-emerald-500/10 p-3">
                    <span className="text-xs text-emerald-200">+{addedLines} lines added</span>
                  </div>
                  <div className="flex-1 rounded-app-md bg-red-500/10 p-3">
                    <span className="text-xs text-red-200">-{removedLines} lines removed</span>
                  </div>
                </div>
                <pre className="m-0 whitespace-pre-wrap break-words rounded-app-lg bg-app-bg/50 p-5 text-xs leading-relaxed text-app-muted">
                  {selectedVersion.content.split('\n').map((line, i) => {
                    const compareContent = mockVersions.find((v) => v.id === compareVersion)?.content || '';
                    const isAdded = !compareContent.includes(line) && line.trim();

                    if (isAdded) {
                      return (
                        <div key={i} className="bg-emerald-500/15 px-2 py-0.5">
                          <span className="mr-2 text-emerald-300">+</span>
                          {line}
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="px-2 py-0.5">
                        {line || ' '}
                      </div>
                    );
                  })}
                </pre>
              </div>
            ) : (
              <pre className="m-0 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-app-muted">
                {selectedVersion.content}
              </pre>
            )}
          </Surface>
        </div>
      </div>
    </PageShell>
  );
}

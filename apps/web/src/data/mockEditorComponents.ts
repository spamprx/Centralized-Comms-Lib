import type { ComponentLibraryEntry } from '../services/componentService';

/**
 * Offline fallback when GET /components is unreachable (dev / API down).
 * Shape matches API `ComponentLibraryEntry`.
 */
export const mockEditorComponents: ComponentLibraryEntry[] = [
  {
    id: 'static-hero',
    key: 'hero-intro',
    name: 'Hero introduction',
    description: 'Title, subtitle, and primary CTA block for article tops.',
    category: 'CONTENT',
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    latestVersion: null,
  },
  {
    id: 'static-disclaimer',
    key: 'legal-disclaimer-short',
    name: 'Short legal disclaimer',
    description: 'One-paragraph compliance notice for public-facing pages.',
    category: 'LEGAL',
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-02-01T15:30:00.000Z',
    latestVersion: null,
  },
  {
    id: 'static-steps',
    key: 'numbered-howto',
    name: 'Numbered how-to steps',
    description: 'Ordered list scaffold for procedural content.',
    category: 'CONTENT',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    latestVersion: null,
  },
  {
    id: 'static-cta',
    key: 'cta-banner',
    name: 'CTA banner',
    description: 'Highlighted call-to-action strip with link placeholder.',
    category: 'CTA',
    createdAt: '2026-02-02T11:00:00.000Z',
    updatedAt: '2026-02-02T11:00:00.000Z',
    latestVersion: null,
  },
  {
    id: 'static-quote',
    key: 'pull-quote',
    name: 'Pull quote',
    description: 'Indented quotation block for expert or user quotes.',
    category: 'CONTENT',
    createdAt: '2026-02-05T14:00:00.000Z',
    updatedAt: '2026-02-05T14:00:00.000Z',
    latestVersion: null,
  },
];

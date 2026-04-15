// ─── MyContent Mock Data ──────────────────────────────────────────────────────

export interface MyContentItem {
  id: string;
  title: string;
  type: 'article' | 'video' | 'podcast' | 'document';
  status: 'draft' | 'in_review' | 'published' | 'archived';
  views: number;
  lastModified: string;
  createdAt: string;
  /** Accepted co-authors only (not counting primary). */
  collaborators: number;
  workspaceRole: 'author' | 'co_author';
  primaryAuthor: { id: string; displayName: string; email: string } | null;
}

export interface ContentStats {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

export const mockMyContent: MyContentItem[] = [
  {
    id: '1',
    title: 'Q1 Marketing Strategy Document',
    type: 'document',
    status: 'published',
    views: 1240,
    lastModified: '2025-03-10',
    createdAt: '2025-02-15',
    collaborators: 3,
    workspaceRole: 'author',
    primaryAuthor: { id: 'u1', displayName: 'Demo User', email: 'demo@example.com' },
  },
  {
    id: '2',
    title: 'Product Launch Video Script',
    type: 'video',
    status: 'in_review',
    views: 0,
    lastModified: '2025-03-09',
    createdAt: '2025-03-01',
    collaborators: 2,
    workspaceRole: 'author',
    primaryAuthor: { id: 'u1', displayName: 'Demo User', email: 'demo@example.com' },
  },
  {
    id: '3',
    title: 'Customer Success Story: Acme Corp',
    type: 'article',
    status: 'published',
    views: 856,
    lastModified: '2025-03-08',
    createdAt: '2025-02-20',
    collaborators: 1,
    workspaceRole: 'author',
    primaryAuthor: { id: 'u1', displayName: 'Demo User', email: 'demo@example.com' },
  },
  {
    id: '4',
    title: 'Employee Onboarding Guide',
    type: 'document',
    status: 'draft',
    views: 0,
    lastModified: '2025-03-07',
    createdAt: '2025-03-05',
    collaborators: 0,
    workspaceRole: 'author',
    primaryAuthor: { id: 'u1', displayName: 'Demo User', email: 'demo@example.com' },
  },
  {
    id: '5',
    title: 'Tech Talk: AI in Content Creation',
    type: 'podcast',
    status: 'published',
    views: 2340,
    lastModified: '2025-03-06',
    createdAt: '2025-02-10',
    collaborators: 4,
    workspaceRole: 'author',
    primaryAuthor: { id: 'u1', displayName: 'Demo User', email: 'demo@example.com' },
  },
  {
    id: '6',
    title: 'Brand Guidelines 2025',
    type: 'document',
    status: 'archived',
    views: 567,
    lastModified: '2025-02-28',
    createdAt: '2025-01-15',
    collaborators: 2,
    workspaceRole: 'author',
    primaryAuthor: { id: 'u1', displayName: 'Demo User', email: 'demo@example.com' },
  },
  {
    id: '7',
    title: 'Social Media Best Practices',
    type: 'article',
    status: 'published',
    views: 1890,
    lastModified: '2025-03-04',
    createdAt: '2025-02-25',
    collaborators: 1,
    workspaceRole: 'author',
    primaryAuthor: { id: 'u1', displayName: 'Demo User', email: 'demo@example.com' },
  },
  {
    id: '8',
    title: 'Quarterly Review Presentation',
    type: 'document',
    status: 'in_review',
    views: 0,
    lastModified: '2025-03-03',
    createdAt: '2025-03-01',
    collaborators: 5,
    workspaceRole: 'author',
    primaryAuthor: { id: 'u1', displayName: 'Demo User', email: 'demo@example.com' },
  },
];

export const mockContentStats: ContentStats[] = [
  { label: 'Total Content', value: '47', icon: 'content', color: '#8b5cf6' },
  { label: 'Published', value: '32', icon: 'published', color: '#10b981' },
  { label: 'In Review', value: '8', icon: 'review', color: '#f59e0b' },
  { label: 'Total Views', value: '128K', icon: 'views', color: '#06b6d4' },
];

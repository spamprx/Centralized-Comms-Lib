// ─── Library Mock Data ──────────────────────────────────────────────────────

export interface ContentItem {
  id: string;
  title: string;
  type: 'article' | 'video' | 'podcast' | 'document';
  author: string;
  /** Distribution / surface (facet for library filters). */
  channel: string;
  status: 'draft' | 'review' | 'published';
  views: number;
  likes?: number;
  commentsCount?: number;
  createdAt: string;
  thumbnail?: string;
  tags: string[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export const mockContentItems: ContentItem[] = [
  {
    id: '1',
    title: 'Getting Started with Our Platform',
    type: 'article',
    author: 'Alice Johnson',
    channel: 'Web',
    status: 'published',
    views: 12450,
    createdAt: '2025-02-15',
    tags: ['tutorial', 'beginner'],
  },
  {
    id: '2',
    title: 'Advanced Features Deep Dive',
    type: 'video',
    author: 'Bob Smith',
    channel: 'Product',
    status: 'published',
    views: 9823,
    createdAt: '2025-02-20',
    tags: ['advanced', 'features'],
  },
  {
    id: '3',
    title: 'Best Practices for Content Creation',
    type: 'article',
    author: 'Carol Williams',
    channel: 'Marketing',
    status: 'review',
    views: 0,
    createdAt: '2025-03-01',
    tags: ['guide', 'tips'],
  },
  {
    id: '4',
    title: 'Q1 2025 Product Updates',
    type: 'document',
    author: 'David Brown',
    channel: 'Product',
    status: 'published',
    views: 7234,
    createdAt: '2025-03-05',
    tags: ['updates', 'product'],
  },
  {
    id: '5',
    title: 'Customer Success Stories',
    type: 'podcast',
    author: 'Eve Davis',
    channel: 'Support',
    status: 'draft',
    views: 0,
    createdAt: '2025-03-08',
    tags: ['customer', 'stories'],
  },
  {
    id: '6',
    title: 'Marketing Strategy 2025',
    type: 'document',
    author: 'Frank Miller',
    channel: 'Marketing',
    status: 'published',
    views: 5432,
    createdAt: '2025-02-10',
    tags: ['marketing', 'strategy'],
  },
  {
    id: '7',
    title: 'Technical Documentation v2',
    type: 'article',
    author: 'Grace Wilson',
    channel: 'Web',
    status: 'review',
    views: 0,
    createdAt: '2025-03-09',
    tags: ['technical', 'docs'],
  },
  {
    id: '8',
    title: 'User Onboarding Flow',
    type: 'video',
    author: 'Henry Taylor',
    channel: 'Web',
    status: 'published',
    views: 8765,
    createdAt: '2025-02-25',
    tags: ['onboarding', 'ux'],
  },
  {
    id: '9',
    title: 'Community Guidelines',
    type: 'article',
    author: 'Alice Johnson',
    channel: 'Support',
    status: 'published',
    views: 4321,
    createdAt: '2025-01-20',
    tags: ['community', 'rules'],
  },
];

export const mockTags: Tag[] = [
  { id: '1', name: 'Tutorial', color: '#8b5cf6' },
  { id: '2', name: 'Guide', color: '#06b6d4' },
  { id: '3', name: 'Advanced', color: '#f59e0b' },
  { id: '4', name: 'Beginner', color: '#10b981' },
  { id: '5', name: 'Product', color: '#ec4899' },
];

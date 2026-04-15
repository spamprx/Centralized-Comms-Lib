export interface NavItem {
  path: string;
  label: string;
}

export interface NavCategory {
  label: string;
  items: NavItem[];
}

export const navCategories: NavCategory[] = [
  {
    label: 'Core',
    items: [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/my-content', label: 'My Content' },
    ],
  },
  {
    label: 'Content',
    items: [
      { path: '/library', label: 'Library' },
      { path: '/templates', label: 'Templates' },
      { path: '/assets', label: 'Assets' },
    ],
  },
  {
    label: 'Review',
    items: [{ path: '/review', label: 'Review' }],
  },
  {
    label: 'Insights',
    items: [
      { path: '/analytics', label: 'Analytics' },
      { path: '/ai-tutor', label: 'AI Tutor' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/profile', label: 'Profile' },
      { path: '/admin', label: 'Admin' },
    ],
  },
];

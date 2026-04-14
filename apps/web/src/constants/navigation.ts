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
    label: "App",
    items: [
      { path: "/dashboard", label: "Dashboard" },
      { path: "/my-content", label: "My Content" },
      { path: "/profile", label: "Profile" },
    ],
  },
  {
    label: "Library",
    items: [
      { path: "/library", label: "Browse Library" },
      { path: "/templates", label: "Templates" },
      { path: "/library/demo", label: "Reading" },
    ],
  },
  {
    label: "Editor",
    items: [
      { path: "/editor/new", label: "Editor" },
      { path: "/preview/new", label: "Preview" },
    ],
  },
  {
    label: "Review",
    items: [{ path: "/review/new", label: "Review" }],
  },
  {
    label: "Assets",
    items: [{ path: "/assets", label: "Asset Management" }],
  },
  {
    label: "AI",
    items: [{ path: "/ai-tutor", label: "AI Tutor" }],
  },
  {
    label: "Admin",
    items: [{ path: "/admin", label: "Admin Panel" }],
  },
  {
    label: "Analytics",
    items: [{ path: "/analytics", label: "Analytics" }],
  },
];

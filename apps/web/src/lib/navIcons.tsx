import type { ReactElement } from 'react';
import {
  Home,
  LayoutDashboard,
  FolderKanban,
  Lightbulb,
  MessageSquare,
  Settings,
} from 'lucide-react';
import type { NavCategory } from '../constants/navigation';

const iconByLabel: Record<string, ReactElement> = {
  Public: <Home />,
  Core: <LayoutDashboard />,
  Content: <FolderKanban />,
  Insights: <Lightbulb />,
  System: <Settings />,
  Review: <MessageSquare />,
};

export function getNavIcon(category: NavCategory): ReactElement {
  return iconByLabel[category.label] ?? <LayoutDashboard />;
}

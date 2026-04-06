import type { ReactElement } from "react";
import { Home, LayoutDashboard, BookOpen, Edit, MessageSquare, Image, Bot, Settings } from "lucide-react";
import type { NavCategory } from "../constants/navigation";

const iconByLabel: Record<string, ReactElement> = {
  "Public": <Home />,
  "App": <LayoutDashboard />,
  "Library": <BookOpen />,
  "Editor": <Edit />,
  "Review": <MessageSquare />,
  "Assets": <Image />,
  "AI": <Bot />,
  "Admin & Analytics": <Settings />,
};

export function getNavIcon(category: NavCategory): ReactElement {
  return iconByLabel[category.label] ?? <LayoutDashboard />;
}

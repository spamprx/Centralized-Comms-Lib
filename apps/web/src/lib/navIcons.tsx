import type { ReactElement } from "react";
import Home from "@mui/icons-material/Home";
import Dashboard from "@mui/icons-material/Dashboard";
import MenuBook from "@mui/icons-material/MenuBook";
import Edit from "@mui/icons-material/Edit";
import RateReview from "@mui/icons-material/RateReview";
import PhotoLibrary from "@mui/icons-material/PhotoLibrary";
import SmartToy from "@mui/icons-material/SmartToy";
import AdminPanelSettings from "@mui/icons-material/AdminPanelSettings";
import type { NavCategory } from "../constants/navigation";

const iconByLabel: Record<string, ReactElement> = {
  "Public": <Home />,
  "App": <Dashboard />,
  "Library": <MenuBook />,
  "Editor": <Edit />,
  "Review": <RateReview />,
  "Assets": <PhotoLibrary />,
  "AI": <SmartToy />,
  "Admin & Analytics": <AdminPanelSettings />,
};

export function getNavIcon(category: NavCategory): ReactElement {
  return iconByLabel[category.label] ?? <Dashboard />;
}

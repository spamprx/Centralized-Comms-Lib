import type { RouteGroup } from "./routeConfig";

import HomePage from "../pages/Home/HomePage";
import LoginPage from "../pages/Auth/LoginPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import ContentLibraryPage from "../pages/Library/ContentLibraryPage";
import ContentReadingPage from "../pages/Library/ContentReadingPage";
import ContentEditorPage from "../pages/Editor/ContentEditorPage";
import ContentPreviewPage from "../pages/Editor/ContentPreviewPage";
import ReviewPage from "../pages/Review/ReviewPage";
import VersionHistoryPage from "../pages/Review/VersionHistoryPage";
import MyContentPage from "../pages/MyContent/MyContentPage";
import AssetManagementPage from "../pages/Assets/AssetManagementPage";
import AITutorPage from "../pages/AI/AITutorPage";
import AdminPanelPage from "../pages/Admin/AdminPanelPage";
import AnalyticsPage from "../pages/Analytics/AnalyticsPage";
import ProfilePage from "../pages/Profile/ProfilePage";

/**
 * Layered route configuration by feature.
 * Add or remove routes here; AppRoutes will render them automatically.
 */
export const routeGroups: RouteGroup[] = [
  {
    label: "Public",
    routes: [
      { path: "/", element: <HomePage /> },
      { path: "/login", element: <LoginPage /> },
    ],
  },
  {
    label: "App",
    routes: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/my-content", element: <MyContentPage /> },
      { path: "/profile", element: <ProfilePage /> },
    ],
  },
  {
    label: "Library",
    routes: [
      { path: "/library", element: <ContentLibraryPage /> },
      { path: "/library/:contentId", element: <ContentReadingPage /> },
    ],
  },
  {
    label: "Editor",
    routes: [
      { path: "/editor/:contentId", element: <ContentEditorPage /> },
      { path: "/preview/:contentId", element: <ContentPreviewPage /> },
    ],
  },
  {
    label: "Review",
    routes: [
      { path: "/review/:contentId", element: <ReviewPage /> },
      { path: "/history/:contentId", element: <VersionHistoryPage /> },
    ],
  },
  {
    label: "Assets",
    routes: [{ path: "/assets", element: <AssetManagementPage /> }],
  },
  {
    label: "AI",
    routes: [{ path: "/ai-tutor", element: <AITutorPage /> }],
  },
  {
    label: "Admin & Analytics",
    routes: [
      { path: "/admin", element: <AdminPanelPage /> },
      { path: "/analytics", element: <AnalyticsPage /> },
    ],
  },
];

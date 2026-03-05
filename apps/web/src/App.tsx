import { Routes, Route } from "react-router-dom";

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

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/dashboard" element={<DashboardPage />} />

      <Route path="/library" element={<ContentLibraryPage />} />
      <Route path="/library/:contentId" element={<ContentReadingPage />} />

      <Route path="/editor/:contentId" element={<ContentEditorPage />} />
      <Route path="/preview/:contentId" element={<ContentPreviewPage />} />

      <Route path="/review/:contentId" element={<ReviewPage />} />
      <Route path="/history/:contentId" element={<VersionHistoryPage />} />

      <Route path="/my-content" element={<MyContentPage />} />

      <Route path="/assets" element={<AssetManagementPage />} />

      <Route path="/ai-tutor" element={<AITutorPage />} />

      <Route path="/admin" element={<AdminPanelPage />} />

      <Route path="/analytics" element={<AnalyticsPage />} />

      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  );
}
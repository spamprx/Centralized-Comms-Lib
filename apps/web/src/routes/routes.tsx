import type { RouteGroup } from './routeConfig';
import ProtectedRoute from '../components/ProtectedRoute';

import HomePage from '../pages/Home/HomePage';
import LoginPage from '../pages/Auth/LoginPage';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import ContentLibraryPage from '../pages/Library/ContentLibraryPage';
import ContentReadingPage from '../pages/Library/ContentReadingPage';
import { TemplatesPage } from '../components/templates';
import ContentEditorPage from '../pages/Editor/ContentEditorPage';
import ContentPreviewPage from '../pages/Editor/ContentPreviewPage';
import ReviewPage from '../pages/Review/ReviewPage';
import VersionHistoryPage from '../pages/Review/VersionHistoryPage';
import MyContentPage from '../pages/MyContent/MyContentPage';
import AssetManagementPage from '../pages/Assets/AssetManagementPage';
import AITutorPage from '../pages/AI/AITutorPage';
import AdminPanelPage from '../pages/Admin/AdminPanelPage';
import AnalyticsPage from '../pages/Analytics/AnalyticsPage';
import ProfilePage from '../pages/Profile/ProfilePage';

/**
 * Layered route configuration by feature.
 * Add or remove routes here; AppRoutes will render them automatically.
 */
export const routeGroups: RouteGroup[] = [
  {
    label: 'Public',
    routes: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
    ],
  },
  {
    label: 'Core',
    routes: [
      {
        path: '/dashboard',
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/my-content',
        element: (
          <ProtectedRoute>
            <MyContentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    label: 'Content',
    routes: [
      {
        path: '/library',
        element: (
          <ProtectedRoute>
            <ContentLibraryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/templates',
        element: (
          <ProtectedRoute>
            <TemplatesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/templates/:templateId',
        element: (
          <ProtectedRoute>
            <TemplatesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/templates/:templateId/edit',
        element: (
          <ProtectedRoute>
            <TemplatesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/library/:contentId',
        element: (
          <ProtectedRoute>
            <ContentReadingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/assets',
        element: (
          <ProtectedRoute>
            <AssetManagementPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    label: 'Collaboration',
    routes: [
      {
        path: '/review',
        element: (
          <ProtectedRoute>
            <ReviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/editor/:contentId',
        element: (
          <ProtectedRoute>
            <ContentEditorPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/preview/:contentId',
        element: (
          <ProtectedRoute>
            <ContentPreviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/review/:contentId',
        element: (
          <ProtectedRoute>
            <ReviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/history/:contentId',
        element: (
          <ProtectedRoute>
            <VersionHistoryPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    label: 'Insights',
    routes: [
      {
        path: '/analytics',
        element: (
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/ai-tutor',
        element: (
          <ProtectedRoute>
            <AITutorPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    label: 'System',
    routes: [
      {
        path: '/admin',
        element: (
          <ProtectedRoute>
            <AdminPanelPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
];

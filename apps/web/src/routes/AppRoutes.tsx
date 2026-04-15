import { Route, Routes } from 'react-router-dom';
import { routeGroups } from './routes';

/**
 * Renders the application route tree from the layered config.
 * All routes are defined in routes.tsx and grouped by feature.
 */
export function AppRoutes() {
  return (
    <Routes>
      {routeGroups.flatMap((group) =>
        group.routes.map(({ path, element }) => <Route key={path} path={path} element={element} />),
      )}
    </Routes>
  );
}

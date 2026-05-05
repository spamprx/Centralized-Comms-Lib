import { AppRoutes } from '../routes';
import Sidebar from '../components/Sidebar';
import PushToastHub from '../components/PushToastHub';
import { useAuth } from '../context/AuthContext';

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen w-full bg-app-bg">
      {isAuthenticated ? <Sidebar /> : null}
      <main
        className={`relative min-h-screen w-full transition-[padding] duration-300 ease-out ${
          isAuthenticated ? 'app-main-canvas md:pl-16' : ''
        }`}
      >
        <AppRoutes />
      </main>
      {isAuthenticated ? <PushToastHub /> : null}
    </div>
  );
}

import { AppRoutes } from "../routes";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen w-full">
      {isAuthenticated && <Sidebar />}
      <main className={isAuthenticated ? "pl-14 min-h-screen w-full" : "min-h-screen w-full"}>
        <AppRoutes />
      </main>
    </div>
  );
}

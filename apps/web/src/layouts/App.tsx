import { AppRoutes } from "../routes";
import Sidebar from "../components/Sidebar";

export default function App() {
  return (
    <div className="min-h-screen w-full">
      <Sidebar />
      <main className="pl-14 min-h-screen w-full">
        <AppRoutes />
      </main>
    </div>
  );
}

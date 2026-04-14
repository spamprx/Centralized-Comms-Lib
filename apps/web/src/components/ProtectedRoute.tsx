import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return (
      <div
        className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 py-16 text-app-muted"
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-app-accent" aria-hidden />
        <p className="text-sm">Loading session…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

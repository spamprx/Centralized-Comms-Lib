import { createContext, useContext, useState, type ReactNode } from "react";
import { authService } from "../services/authService";

type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  role?: string;
};

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthReady: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem("auth_user")));
  const [isAuthReady] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(() => {
    const rawUser = localStorage.getItem("auth_user");
    if (!rawUser) return null;
    try {
      return JSON.parse(rawUser) as AuthUser;
    } catch {
      return null;
    }
  });

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    localStorage.setItem("auth_user", JSON.stringify(res.user));
    setUser(res.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    void authService.logout();
    localStorage.removeItem("auth_user");
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAuthReady, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

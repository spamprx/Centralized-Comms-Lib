import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authService } from "../services/authService";
import { setAuthToken, decodeTokenPayload } from "../services/tokenStore";

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

/** Derive an AuthUser from the JWT payload stored in the cookie */
function getUserFromToken(): AuthUser | null {
  const payload = decodeTokenPayload();
  if (!payload) return null;
  return { id: payload.id, email: payload.email, role: payload.role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialUser = getUserFromToken();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(initialUser);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      // First, if we can decode a user from a non-HttpOnly token cookie, set it optimistically
      // (so UI can render while we confirm with /auth/me).
      const fromToken = getUserFromToken();
      if (fromToken && !cancelled) {
        setUser(fromToken);
      }

      // Validate via /auth/me even if we can't read a token cookie in JS.
      // Many setups store auth in an HttpOnly cookie on the API origin.
      try {
        const me = await authService.me();
        if (!cancelled) {
          if (me.token) setAuthToken(me.token);
          setUser(me.user);
          setIsAuthenticated(true);
          setIsAuthReady(true);
        }
        return;
      } catch {
        // fallthrough
      }

      if (!cancelled) {
        setUser(null);
        setIsAuthenticated(false);
        setIsAuthReady(true);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    // Store token in cookie via tokenStore (also kept in memory)
    setAuthToken(res.token);
    // Use the richer user object from the login response (includes displayName)
    setUser(res.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    void authService.logout();
    // Clear token from cookie and memory
    setAuthToken(null);
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

import { createContext, useContext, useState, type ReactNode } from 'react';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import { setAuthToken, decodeTokenPayload } from '../services/tokenStore';

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
  // On mount: check cookie for an existing token and derive the user from it
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getUserFromToken());
  const [isAuthReady] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(() => getUserFromToken());

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    // Store token in cookie via tokenStore (also kept in memory)
    setAuthToken(res.token);
    // Role is only guaranteed on the JWT — merge so admin UI can gate immediately
    const payload = decodeTokenPayload();
    setUser({
      ...res.user,
      role: payload?.role ?? res.user.role,
    });
    setIsAuthenticated(true);
  };

  const logout = () => {
    void (async () => {
      try {
        await profileService.clearPresence();
      } catch {
        /* still sign out */
      }
      try {
        await authService.logout();
      } catch {
        /* /auth/logout may be unimplemented */
      }
      setAuthToken(null);
      setUser(null);
      setIsAuthenticated(false);
    })();
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

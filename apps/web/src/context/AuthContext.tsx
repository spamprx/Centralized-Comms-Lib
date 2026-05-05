import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';
import { clearSession, setCachedUser } from '../services/tokenStore';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    void authService
      .me()
      .then((data) => {
        if (!data.user) {
          clearSession();
          setUser(null);
          setIsAuthenticated(false);
          return;
        }
        const u: AuthUser = {
          ...data.user,
          role: data.role ?? undefined,
        };
        setCachedUser(u);
        setUser(u);
        setIsAuthenticated(true);
      })
      .catch(() => {
        clearSession();
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsAuthReady(true);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    const u: AuthUser = {
      ...res.user,
      role: res.role ?? 'USER',
    };
    setCachedUser(u);
    setUser(u);
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
        /* ignore */
      }
      clearSession();
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

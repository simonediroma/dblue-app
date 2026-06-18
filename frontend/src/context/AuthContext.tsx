import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '../types/api';
import { getMe, logout as apiLogout, setStoredToken, clearStoredToken } from '../services/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setStoredToken(urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    }

    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    try {
      await apiLogout();
    } catch {
      // ignore errors — still clear local state
    }
    clearStoredToken();
    setUser(null);
    window.location.href = '/login';
  }

  async function refreshUser() {
    try {
      const updated = await getMe();
      setUser(updated);
    } catch {
      // ignore — keep current user state
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type UserRole = "client" | "admin";

type User = {
  name: string;
  email: string;
  role: UserRole;
};

type AuthContextValue = {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isReady: boolean; // ✅ NEW
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false); // ✅ NEW

  // Load user from localStorage once on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("agentbazaar_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    } finally {
      setIsReady(true); // ✅ mark as ready whether or not we found a user
    }
  }, []);

  const login = (u: User) => {
    setUser(u);
    try {
      localStorage.setItem("agentbazaar_user", JSON.stringify(u));
    } catch {
      // ignore
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("agentbazaar_user");
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

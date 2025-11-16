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
  isReady: boolean; 
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false); 
  useEffect(() => {
    try {
      const stored = localStorage.getItem("agentbazaar_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
    } finally {
      setIsReady(true); 
    }
  }, []);

  const login = (u: User) => {
    setUser(u);
    try {
      localStorage.setItem("agentbazaar_user", JSON.stringify(u));
    } catch {
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("agentbazaar_user");
    } catch {
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

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { clearSession, loadUser, saveSession } from "../lib/session";
import type { User } from "../types";

interface AuthValue {
  user: User | null;
  canControl: boolean; // hanya admin yang boleh mengontrol dan mengubah pengaturan
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.login(username, password);
    saveSession(result);
    setUser(result.user);
  }, []);

  useEffect(() => {
    window.addEventListener("irigasi:unauthorized", logout);
    return () => window.removeEventListener("irigasi:unauthorized", logout);
  }, [logout]);

  const value = useMemo(() => ({ user, canControl: user?.role === "admin", login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
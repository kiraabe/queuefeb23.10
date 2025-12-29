import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser, LoginResponse, MeResponse } from "@shared/api";
import { apiFetch } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null | undefined; // undefined while loading
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    apiFetch<MeResponse>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(username: string, password: string, mode?: string) {
        const res = await apiFetch<LoginResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password, mode }),
        });
        setUser(res.user);
        return res.user;
      },
      async logout() {
        try {
          await apiFetch("/api/auth/logout", { method: "POST" });
        } catch {}
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

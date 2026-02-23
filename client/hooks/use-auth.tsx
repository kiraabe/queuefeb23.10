import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser, LoginResponse, MeResponse } from "@shared/api";
import { apiFetch } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null | undefined; // undefined while loading
  login: (
    username: string,
    password: string,
    role?: string,
  ) => Promise<AuthUser>;
  logout: () => Promise<void>;
  switchRole: (role: string) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    apiFetch<MeResponse>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  // Session heartbeat - keep session active while tab is open
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      // Don't send heartbeats if the page is hidden to save resources
      // The session will eventually expire due to inactivity (30 mins) if the tab is backgrounded for too long
      if (document.visibilityState === "hidden") return;

      try {
        await apiFetch("/api/auth/heartbeat");
      } catch (err) {
        // If heartbeat fails with 401, the session is likely gone
        if ((err as any)?.status === 401) {
          setUser(null);
        }
      }
    }, 60 * 1000); // Heartbeat every 60 seconds

    return () => clearInterval(interval);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(username: string, password: string, role?: string) {
        const res = await apiFetch<LoginResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password, role }),
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
      async switchRole(role: string) {
        const res = await apiFetch<LoginResponse>("/api/auth/switch-role", {
          method: "POST",
          body: JSON.stringify({ role }),
        });
        setUser(res.user);
        return res.user;
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

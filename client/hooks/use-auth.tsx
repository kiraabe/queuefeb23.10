import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser, LoginResponse, MeResponse } from "@shared/api";
import { apiFetch, apiUrl } from "@/lib/api";

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
  // This ensures that last_activity_at is updated every 60 seconds to prevent session timeout (30 min idle)
  useEffect(() => {
    if (!user) return;

    let isHeartbeatPending = false;
    let lastActivityTime = Date.now();

    // Track user activity
    const updateActivity = () => {
      lastActivityTime = Date.now();
    };

    window.addEventListener("mousedown", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("scroll", updateActivity);
    window.addEventListener("touchstart", updateActivity);

    // Register this tab
    apiFetch("/api/auth/tab-opened", { method: "POST" }).catch(() => {});

    // Notify server when tab is closed
    const handleBeforeUnload = () => {
      const data = JSON.stringify({});
      // Use fetch with keepalive as a modern alternative to sendBeacon
      // that allows custom headers (like X-Requested-With if needed,
      // though simple requests might not need it depending on server config)
      fetch(apiUrl("/api/auth/tab-closed"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: data,
        keepalive: true,
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    const interval = setInterval(async () => {
      // Don't send heartbeats if the page is hidden to save resources
      // The session will eventually expire due to inactivity (30 mins) if the tab is backgrounded for too long
      if (document.visibilityState === "hidden") {
        return;
      }

      // Don't send heartbeat if there has been no user activity for 30 minutes
      if (Date.now() - lastActivityTime > 30 * 60 * 1000) {
        return;
      }

      // Prevent multiple heartbeats in flight
      if (isHeartbeatPending) {
        return;
      }

      isHeartbeatPending = true;
      try {
        const response = await apiFetch<{ ok: boolean; lastActivityAt: number }>(
          "/api/auth/heartbeat",
        );
        lastHeartbeatTime = Date.now();

        // Log successful heartbeat in development
        if (process.env.NODE_ENV === "development") {
          console.debug(
            `[Auth] Heartbeat successful at ${new Date(response.lastActivityAt).toISOString()}`,
          );
        }
      } catch (err) {
        // If heartbeat fails with 401, the session is likely gone or revoked
        if ((err as any)?.status === 401) {
          console.warn("[Auth] Session invalid (401). User will be logged out.");
          setUser(null);
        } else {
          // For other errors, log but don't force logout yet
          console.warn("[Auth] Heartbeat failed:", (err as any)?.status || err);
        }
      } finally {
        isHeartbeatPending = false;
      }
    }, 60 * 1000); // Heartbeat every 60 seconds, well within the 30-minute idle timeout

    return () => {
      clearInterval(interval);
      window.removeEventListener("mousedown", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("scroll", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
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

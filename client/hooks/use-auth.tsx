import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  // This ensures that last_activity_at is updated to prevent session timeout (2 min idle)
  useEffect(() => {
    if (!user) return;

    let isHeartbeatPending = false;
    let lastActivityTime = Date.now();
    let lastHeartbeatTime = Date.now();

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
      // Use sendBeacon for reliable delivery during page unload
      // It doesn't support custom headers, but the server doesn't need them for this endpoint
      try {
        const data = JSON.stringify({});
        if (navigator.sendBeacon) {
          // sendBeacon is the standard API for sending data during unload
          navigator.sendBeacon(apiUrl("/api/auth/tab-closed"), data);
        } else {
          // Fallback for browsers without sendBeacon (rare nowadays)
          fetch(apiUrl("/api/auth/tab-closed"), {
            method: "POST",
            body: data,
            keepalive: true,
          }).catch(() => {
            // Silently ignore fetch errors during unload
          });
        }
      } catch {
        // Silently ignore any errors during page unload
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    const interval = setInterval(async () => {
      // Don't send heartbeats if the page is hidden to save resources
      // The session will eventually expire due to inactivity (2 mins) if the tab is backgrounded for too long
      if (document.visibilityState === "hidden") {
        return;
      }

      // Don't send heartbeat if there has been no user activity for 30 minutes
      // (session would have timed out on the server)
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
          "/api/session/ping",
          { method: "POST" },
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
        // Immediately log out (within ~100ms of getting the error)
        if ((err as any)?.status === 401) {
          console.warn("[Auth] Session invalid (401). Logging out immediately.");
          setUser(null);
        } else {
          // For other errors, log but don't force logout yet
          console.warn("[Auth] Heartbeat failed:", (err as any)?.status || err);
        }
      } finally {
        isHeartbeatPending = false;
      }
    }, 2 * 1000); // Heartbeat every 2 seconds for immediate timeout detection (within ~2-3 second total latency)

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

/**
 * Hook to redirect to login when session is lost
 * Call this in your router to monitor session state and redirect when user loses access
 */
export function useSessionLostRedirect() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const previousUserRef = useRef<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    // Only redirect if:
    // 1. We were previously logged in (previousUserRef.current is not null/undefined)
    // 2. AND we are now logged out (user === null)
    // 3. AND we've already loaded auth state (not still loading with undefined)
    const wasLoggedIn = previousUserRef.current !== null && previousUserRef.current !== undefined;
    const isNowLoggedOut = user === null;
    const hasLoadedAuthState = previousUserRef.current !== undefined;

    if (wasLoggedIn && isNowLoggedOut && hasLoadedAuthState) {
      console.log("[Auth] Session lost/expired - redirecting to login");
      navigate("/login", { replace: true });
    }

    // Update previous user state
    if (user !== undefined) {
      previousUserRef.current = user;
    }
  }, [user, navigate]);
}

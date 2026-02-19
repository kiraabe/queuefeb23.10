import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

function isMobileOrTablet(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();

  // Detect mobile/tablet devices
  const mobilePatterns = [
    /android/,
    /webos/,
    /iphone/,
    /ipad/,
    /ipod/,
    /blackberry/,
    /windows phone/,
  ];

  if (mobilePatterns.some((pattern) => pattern.test(userAgent))) {
    return true;
  }

  // Check screen size as additional indicator
  if (window.innerWidth <= 1024) {
    // Additional check: if it looks like a phone/tablet, not just a small desktop
    const touchSupport = () => {
      return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0
      );
    };

    if (touchSupport() && window.innerWidth <= 768) {
      return true;
    }
  }

  return false;
}

interface SessionInfo {
  username: string;
  activeSessionCount: number;
  maxSessions: number;
  canLogin: boolean;
}

export default function Login() {
  const [isMobile, setIsMobile] = useState(false);
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);

  useEffect(() => {
    const detected = isMobileOrTablet();
    setIsMobile(detected);
  }, []);

  // Check session count when username changes
  useEffect(() => {
    if (!username.trim()) {
      setSessionInfo(null);
      return;
    }

    const checkSessionCount = async () => {
      setCheckingSession(true);
      try {
        const trimmedUsername = username.trim();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(
          `/api/auth/session-count/${encodeURIComponent(trimmedUsername)}`,
          {
            signal: controller.signal,
            credentials: "include",
            headers: {
              "X-Requested-With": "fetch",
            },
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data: SessionInfo = await response.json();
          setSessionInfo(data);
        } else {
          setSessionInfo(null);
        }
      } catch (err) {
        // Silently fail for session count check - it's not critical
        console.debug("Failed to fetch session count:", err);
        setSessionInfo(null);
      } finally {
        setCheckingSession(false);
      }
    };

    // Debounce the check (wait 800ms after user stops typing to reduce requests)
    const timer = setTimeout(checkSessionCount, 800);
    return () => clearTimeout(timer);
  }, [username]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const u = username.trim();
    const p = password.trim();

    if (!u) {
      setError("Please enter your username or window number.");
      return;
    }

    if (!p) {
      setError("Please enter your password.");
      return;
    }

    setPending(true);
    try {
      const user = await login(u, p);

      // If user has multiple roles, redirect to role selector
      if (user.roles && user.roles.length > 1) {
        navigate("/role-selector");
      } else {
        // Determine default redirect based on user role
        const defaultRedirect =
          user.role === "admin"
            ? "/admin"
            : user.role === "teller" && user.windowId
              ? `/teller/${user.windowId}`
              : user.role === "reception"
                ? "/reception"
                : user.role === "employee"
                  ? "/employee"
                  : user.role === "archiever"
                    ? "/archiever"
                    : "/";

        // Only use redirect param if it's safe for this user's role
        const redirectParam = params.get("redirect");
        let to = defaultRedirect;

        if (redirectParam) {
          // Map allowed redirect destinations by role
          const allowedByRole: Record<string, string[]> = {
            admin: [
              "/",
              "/role-selector",
              "/admin",
              "/teller",
              "/reception",
              "/queue",
              "/display",
              "/tickets/",
            ],
            teller: [
              "/",
              "/role-selector",
              "/teller",
              "/queue",
              "/display",
              "/tickets/",
            ],
            reception: [
              "/",
              "/role-selector",
              "/reception",
              "/queue",
              "/display",
              "/tickets/",
            ],
            employee: [
              "/",
              "/role-selector",
              "/employee",
              "/queue",
              "/display",
              "/tickets/",
            ],
            archiever: [
              "/",
              "/role-selector",
              "/archiever",
              "/queue",
              "/display",
              "/tickets/",
            ],
          };

          const allowed = allowedByRole[user.role] || ["/"];
          const isAllowed = allowed.some(
            (path) => redirectParam === path || redirectParam.startsWith(path),
          );

          if (isAllowed && redirectParam !== defaultRedirect) {
            to = redirectParam;
          }
        }

        navigate(to);
      }
    } catch (e: any) {
      setError(
        e?.message || "An unexpected error occurred. Please try again later.",
      );
    } finally {
      setPending(false);
    }
  };

  if (isMobile) {
    return (
      <div className="container py-16">
        <div className="mx-auto max-w-md">
          <Card className="border-destructive/50 bg-destructive/10">
            <CardHeader>
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                <div>
                  <CardTitle className="text-destructive">
                    Desktop Only
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    This system is only accessible from desktop browsers for
                    security reasons.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Please use a desktop or laptop computer to access the system.
                Mobile and tablet access are not supported.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-md">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Enter your username/window number and password
            </p>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={onSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="username">Username or Window Number</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username or window (1-20)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label="Password"
                    className={showPassword ? "select-none" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-2 inline-flex items-center rounded-md p-2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Active Sessions Display */}
              {sessionInfo && (
                <div
                  className={`rounded-md p-3 text-sm ${
                    sessionInfo.canLogin
                      ? "bg-blue-50 border border-blue-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          sessionInfo.canLogin
                            ? "text-blue-900"
                            : "text-red-900"
                        }`}
                      >
                        {sessionInfo.activeSessionCount} of{" "}
                        {sessionInfo.maxSessions} devices logged in
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          sessionInfo.canLogin
                            ? "text-blue-700"
                            : "text-red-700"
                        }`}
                      >
                        {sessionInfo.canLogin
                          ? `You can log in on ${sessionInfo.maxSessions - sessionInfo.activeSessionCount} more device${sessionInfo.maxSessions - sessionInfo.activeSessionCount === 1 ? "" : "s"}.`
                          : "Maximum session limit reached. Please log out from another device to continue."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

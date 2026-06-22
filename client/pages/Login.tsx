import { useState, useEffect, useId } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_CHECK_DEBOUNCE_MS = 800;
const SESSION_CHECK_TIMEOUT_MS = 10_000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionInfo {
  username: string;
  activeSessionCount: number;
  maxSessions: number;
  canLogin: boolean;
  isBlocked: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the default post-login path for a given role.
 * Kept pure so it's easy to unit-test independently of the component.
 */
function defaultPathForRole(role: string, windowId?: number | null): string {
  switch (role) {
    case "admin": return "/admin";
    case "teller": return windowId ? `/teller/${windowId}` : "/teller";
    case "reception": return "/reception";
    case "employee": return "/employee";
    case "archiever": return "/archiever";
    default: return "/";
  }
}

/**
 * Allowed redirect prefixes per role.
 * Paths ending with "/" already cover sub-routes via the prefix check below.
 */
const ALLOWED_REDIRECTS: Record<string, string[]> = {
  admin: ["/", "/admin", "/teller", "/reception", "/queue", "/display", "/tickets/", "/role-selector"],
  teller: ["/", "/teller", "/queue", "/display", "/tickets/", "/role-selector"],
  reception: ["/", "/reception", "/queue", "/display", "/tickets/", "/role-selector"],
  employee: ["/", "/employee", "/queue", "/display", "/tickets/", "/role-selector"],
  archiever: ["/", "/archiever", "/queue", "/display", "/tickets/", "/role-selector"],
};

/**
 * Validates a redirect param against an allowlist.
 * Uses exact-match or prefix + "/" guard to prevent open-redirect attacks
 * where "/admin.evil.com" would pass a naive startsWith("/admin") check.
 */
function isSafeRedirect(redirectParam: string, role: string): boolean {
  const allowed = ALLOWED_REDIRECTS[role] ?? ["/"];
  return allowed.some(
    (path) =>
      redirectParam === path ||
      redirectParam.startsWith(path.endsWith("/") ? path : path + "/"),
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Login() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Stable IDs for aria linkage
  const errorId = useId();
  const sessionInfoId = useId();

  // Capture viewport width once at mount for device-type detection on the server.
  // Reading it at submit time would give the post-resize width, which is misleading.
  const [viewportWidth] = useState(() => window.innerWidth);

  // ── Session-count check ────────────────────────────────────────────────────
  //
  // Debounced so we don't hammer the API on every keystroke.
  // The AbortController is created outside the async fn so it can be cancelled
  // both by the debounce cleanup AND on component unmount.

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setSessionInfo(null);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setSessionLoading(true);
      try {
        const timeoutId = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);
        const response = await fetch(
          `/api/auth/session-count/${encodeURIComponent(trimmed)}`,
          {
            signal: controller.signal,
            credentials: "include",
            headers: { "X-Requested-With": "fetch" },
          },
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          const data: SessionInfo = await response.json();
          setSessionInfo(data);
        } else {
          setSessionInfo(null);
        }
      } catch {
        // Session count is informational — silently ignore failures
        setSessionInfo(null);
      } finally {
        setSessionLoading(false);
      }
    }, SESSION_CHECK_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort(); // cancel any in-flight request on cleanup / unmount
    };
  }, [username]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const u = username.trim();
    // Do NOT trim the password — trailing/leading spaces are valid password chars.
    const p = password;

    if (!u) { setError(t("login.enterUsername")); return; }
    if (!p) { setError(t("login.enterPassword")); return; }

    setPending(true);
    try {
      const user = await login(u, p, viewportWidth);

      if (user.roles && user.roles.length > 1) {
        navigate("/role-selector");
        return;
      }

      const defaultPath = defaultPathForRole(user.role, user.windowId);
      const redirectParam = params.get("redirect");

      const to =
        redirectParam &&
          redirectParam !== defaultPath &&
          isSafeRedirect(redirectParam, user.role)
          ? redirectParam
          : defaultPath;

      navigate(to);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.serverError"));
    } finally {
      setPending(false);
    }
  }

  // ── Derived UI state ───────────────────────────────────────────────────────

  const showSessionWarning = sessionInfo?.isBlocked && !sessionInfo.canLogin;
  const showSessionNotice = sessionInfo?.isBlocked && sessionInfo.canLogin;
  const remainingSlots = sessionInfo
    ? sessionInfo.maxSessions - sessionInfo.activeSessionCount
    : 0;

  const ariaDescribedBy = [
    error ? errorId : null,
    showSessionWarning ? sessionInfoId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-md">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>{t("login.title")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {t("login.subtitle")}
            </p>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={onSubmit}
              aria-describedby={ariaDescribedBy}
              noValidate
            >
              {/* Username */}
              <div className="grid gap-2">
                <Label htmlFor="username">{t("login.username")}</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t("login.usernamePlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={pending}
                />
              </div>

              {/* Password */}
              <div className="grid gap-2">
                <Label htmlFor="password">{t("login.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={pending}
                  // Do NOT prevent copy/paste — it breaks password managers
                  // and is explicitly discouraged by NIST SP 800-63B.
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    aria-pressed={showPassword}
                    disabled={pending}
                    className="absolute inset-y-0 right-2 inline-flex items-center rounded-md p-2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Session info — blocked (cannot log in) */}
              {showSessionWarning && (
                <div
                  id={sessionInfoId}
                  role="alert"
                  className="rounded-md p-3 text-sm bg-red-50 border border-red-200"
                >
                  <p className="font-medium text-red-900">
                    {sessionInfo!.activeSessionCount} of {sessionInfo!.maxSessions} devices logged in
                  </p>
                  <p className="text-xs mt-1 text-red-700">
                    Maximum session limit reached. Please log out from another device to continue.
                  </p>
                </div>
              )}

              {/* Session info — approaching limit but still can log in */}
              {showSessionNotice && (
                <div className="rounded-md p-3 text-sm bg-blue-50 border border-blue-200">
                  <p className="font-medium text-blue-900">
                    {sessionInfo!.activeSessionCount} of {sessionInfo!.maxSessions} devices logged in
                  </p>
                  <p className="text-xs mt-1 text-blue-700">
                    You can log in on {remainingSlots} more device{remainingSlots === 1 ? "" : "s"}.
                  </p>
                </div>
              )}

              {/* Session count loading indicator */}
              {sessionLoading && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                  Checking active sessions…
                </p>
              )}

              {/* Error */}
              {error && (
                <p id={errorId} role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={pending || showSessionWarning}
              >
                {pending ? `${t("login.signIn")}…` : t("login.signIn")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
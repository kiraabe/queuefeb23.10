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

  if (mobilePatterns.some(pattern => pattern.test(userAgent))) {
    return true;
  }

  // Check screen size as additional indicator
  if (window.innerWidth <= 1024) {
    // Additional check: if it looks like a phone/tablet, not just a small desktop
    const touchSupport = () => {
      return (
        ("ontouchstart" in window) ||
        (navigator.maxTouchPoints > 0) ||
        ((navigator as any).msMaxTouchPoints > 0)
      );
    };

    if (touchSupport() && window.innerWidth <= 768) {
      return true;
    }
  }

  return false;
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

  useEffect(() => {
    const detected = isMobileOrTablet();
    setIsMobile(detected);
  }, []);

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
        const to =
          params.get("redirect") ||
          (user.role === "admin"
            ? "/admin"
            : user.role === "teller" && user.windowId
              ? `/teller/${user.windowId}`
              : user.role === "reception"
                ? "/reception"
                : user.role === "employee"
                  ? "/employee"
                  : user.role === "archiever"
                    ? "/archiever"
                    : "/");
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

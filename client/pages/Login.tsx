import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<
    "window" | "admin" | "reception" | "employee"
  >("window");
  const [windowId, setWindowId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const p = password;

    if (!p) {
      setError("Please enter your password.");
      return;
    }

    let usernameToSubmit: string;
    if (mode === "window") {
      const w = windowId.trim();
      if (!w) {
        setError("Please enter a window number (1-6).");
        return;
      }
      usernameToSubmit = w;
    } else {
      const u = username.trim();
      if (!u) {
        setError("Please enter your username.");
        return;
      }
      usernameToSubmit = u;
    }

    setPending(true);
    try {
      const user = await login(usernameToSubmit, p, mode);
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
                : "/");
      navigate(to);
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
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("window");
                  setUsername("");
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  mode === "window"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                Window
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("reception");
                  setWindowId("");
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  mode === "reception"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                Reception
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("admin");
                  setWindowId("");
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  mode === "admin"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("employee");
                  setWindowId("");
                  setError(null);
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  mode === "employee"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                Employee
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={onSubmit}>
              {mode === "window" ? (
                <div className="grid gap-2">
                  <Label htmlFor="windowId">Window</Label>
                  <Input
                    id="windowId"
                    type="number"
                    min="1"
                    placeholder="Enter window number"
                    value={windowId}
                    onChange={(e) => setWindowId(e.target.value)}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="username">
                    {mode === "reception"
                      ? "Reception Username"
                      : mode === "employee"
                        ? "Employee Username"
                        : "Username"}
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              )}
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

import { ReactNode } from "react";
import { useNetworkStatus } from "@/hooks/use-network";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConsoleShell({
  title,
  className,
  children,
  rightPanel,
}: {
  title: string;
  className?: string;
  children: ReactNode;
  rightPanel?: ReactNode;
}) {
  const { online } = useNetworkStatus();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-border/40">
        {/* Header with title and status */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 w-full mb-3 sm:mb-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="font-display text-lg sm:text-xl md:text-2xl font-semibold truncate">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 whitespace-nowrap",
                online
                  ? "bg-green-500/10 text-green-700 dark:text-green-300"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}
              aria-live="polite"
              role="status"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full flex-shrink-0",
                  online ? "bg-green-500" : "bg-amber-500",
                )}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">
                {online ? "Online" : "Offline"}
              </span>
              <span className="sm:hidden">{online ? "On" : "Off"}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        {/* Offline warning */}
        {!online && (
          <div
            role="alert"
            className="rounded-lg border border-amber-400/40 bg-amber-50 p-2 sm:p-3 text-xs sm:text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
          >
            <p className="font-medium">Offline mode</p>
            <p className="mt-1">
              Live updates paused. Changes will sync when reconnected.
            </p>
          </div>
        )}
      </div>

      {/* Main content area - scrollable */}
      <div className="flex-1 overflow-y-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div
          className={cn(
            "w-full grid gap-4 sm:gap-6",
            "grid-cols-1",
            rightPanel ? "lg:grid-cols-[1fr_320px]" : "",
            className,
          )}
        >
          {/* Primary content */}
          <div className="w-full min-w-0">{children}</div>

          {/* Right panel (visible only on lg) */}
          {rightPanel ? (
            <aside
              className="hidden lg:block min-h-0"
              role="complementary"
              aria-label="Additional information"
            >
              {rightPanel}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

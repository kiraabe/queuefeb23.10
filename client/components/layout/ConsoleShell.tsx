import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ConsoleShell({
  title,
  className,
  children,
  rightPanel,
  action,
}: {
  title: string;
  className?: string;
  children: ReactNode;
  rightPanel?: ReactNode;
  action?: ReactNode;
}) {
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
          {action && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {action}
            </div>
          )}
        </div>
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

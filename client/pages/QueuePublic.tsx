import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSSE } from "@/hooks/use-sse";
import { apiFetch, apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  DisplayResponse,
  DisplayState,
  Ticket,
  WindowState,
} from "@shared/api";

async function getDisplay(): Promise<DisplayResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("/api/display", { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch display: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getWindows(): Promise<WindowState[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("/api/windows", { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch windows: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

type QueueEntry = {
  id: string;
  code: string;
  createdAt: number;
  number: number;
};

export default function QueuePublic() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFs = async () => {
    try {
      if (!isFs) await containerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  };

  const [display, setDisplay] = useState<DisplayState | null>(null);
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});

  useEffect(() => {
    let stop = false;
    Promise.all([getDisplay(), getWindows()])
      .then(([d, w]) => {
        if (stop) return;
        setDisplay(d.state);
        setWindows(w);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, []);

  useSSE(apiUrl("/api/events"), (ev) => {
    if (ev.type === "init") {
      const payload: any = ev.payload;
      if (payload.windows) setWindows(payload.windows as WindowState[]);
      if (payload.tickets)
        setTickets(payload.tickets as Record<string, Ticket>);
      if (payload.display) setDisplay(payload.display as DisplayState);
    }
    if (ev.type === "window.updated") {
      const w = ev.payload as WindowState;
      setWindows((prev) => prev.map((x) => (x.id === w.id ? w : x)));
    }
    if (ev.type === "ticket.created" || ev.type === "ticket.updated") {
      const t = ev.payload as Ticket;
      setTickets((m) => ({ ...m, [t.id]: t }));
    }
    if (ev.type === "display.updated") setDisplay(ev.payload as DisplayState);
  });

  const windowCodes = useMemo(() => {
    const map: Record<number, string | null> = {};
    windows.forEach((window) => {
      const ticketId = window.currentTicketId;
      if (!ticketId) {
        map[window.id] = null;
        return;
      }

      const directCode = tickets[ticketId]?.code;
      if (directCode) {
        map[window.id] = directCode;
        return;
      }

      const currentTicket = display?.current?.find((t) => t.id === ticketId);
      const fallbackCode =
        (currentTicket && currentTicket.code) ||
        (display?.next?.id === ticketId && display.next.code) ||
        (display?.nextAfter?.id === ticketId && display.nextAfter.code) ||
        display?.waiting.find((entry) => entry.id === ticketId)?.code;

      map[window.id] = fallbackCode ?? null;
    });
    return map;
  }, [windows, tickets, display]);

  const serving = useMemo(
    () =>
      windows
        .map((window) =>
          window.currentTicketId
            ? { window, ticket: tickets[window.currentTicketId] }
            : null,
        )
        .filter((entry): entry is { window: WindowState; ticket: Ticket } =>
          Boolean(entry?.ticket),
        ),
    [windows, tickets],
  );

  const waitingQueue = useMemo<QueueEntry[]>(() => {
    const waitingTickets = Object.values(tickets)
      .filter((t) => t.status === "waiting")
      .map((t) => ({
        id: t.id,
        code: t.code,
        createdAt: t.createdAt,
        number: t.number,
      }))
      .sort((a, b) => a.createdAt - b.createdAt || a.number - b.number);

    if (waitingTickets.length || !display) return waitingTickets;

    const fallback: QueueEntry[] = [];
    const push = (
      entry:
        | DisplayState["next"]
        | DisplayState["nextAfter"]
        | DisplayState["waiting"][number]
        | null
        | undefined,
    ) => {
      if (!entry) return;
      fallback.push({
        id: entry.id,
        code: entry.code,
        createdAt: entry.createdAt,
        number: fallback.length,
      });
    };

    push(display.next);
    push(display.nextAfter);
    display.waiting.forEach((item) => push(item));

    return fallback;
  }, [tickets, display]);

  const [nextTicket, nextAfterTicket, ...restTickets] = waitingQueue;

  const hasLiveQueue = useMemo(() => {
    if (serving.length > 0) return true;
    if (waitingQueue.length > 0) return true;
    if (display && (display.current || display.next || display.nextAfter))
      return true;
    return false;
  }, [display, serving, waitingQueue]);

  const actionMessage =
    serving.length > 0 || display?.current
      ? "Please proceed when called"
      : "Please proceed to waiting area";

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full bg-background",
        isFs ? "fixed inset-0 min-h-screen overflow-auto" : "min-h-screen",
      )}
    >
      <div
        className={cn(
          isFs
            ? "px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10"
            : "px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10",
        )}
      >
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex items-center justify-between gap-4 flex-wrap">
          <h1
            className={cn(
              "font-display font-bold text-foreground",
              isFs
                ? "text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
                : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl",
            )}
          >
            {isFs ? "Now Serving" : "Queue Status"}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFs}
            aria-pressed={isFs}
            aria-label={isFs ? "Exit full screen" : "Enter full screen"}
            className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 flex-shrink-0"
          >
            {isFs ? "Exit FS" : "Full Screen"}
          </Button>
        </div>

        {/* Window Cards Grid */}
        <div
          className={cn(
            "w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            isFs
              ? "gap-4 sm:gap-6 md:gap-8 mb-0"
              : "gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-12 md:mb-16",
          )}
        >
          {windows.map((w) => {
            const code = windowCodes[w.id] ?? null;
            return (
              <Card
                key={w.id}
                className={cn(
                  "border border-border/60 bg-card/90 shadow-lg hover:shadow-xl transition-shadow",
                  isFs
                    ? "rounded-3xl sm:rounded-4xl p-6 sm:p-8 md:p-10"
                    : "rounded-2xl sm:rounded-3xl p-4 sm:p-6",
                )}
                role="region"
                aria-label={`${w.name}: ${code ? `Now serving ${code}` : "Idle"}`}
              >
                <div
                  className={cn(
                    "uppercase tracking-wide font-medium text-muted-foreground",
                    isFs ? "text-sm sm:text-base" : "text-xs sm:text-sm",
                  )}
                >
                  {w.name}
                </div>
                <div
                  className={cn(
                    "mt-4 font-display font-bold",
                    isFs
                      ? "text-5xl sm:text-6xl md:text-7xl lg:text-8xl"
                      : "text-xl sm:text-2xl md:text-3xl",
                  )}
                >
                  <span className="text-green-600 dark:text-green-400">
                    {code ?? "—"}
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-3 text-muted-foreground font-medium",
                    isFs ? "text-sm sm:text-base" : "text-xs sm:text-sm",
                  )}
                >
                  {w.busy ? (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400 inline-block"></span>
                      Serving
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400 inline-block"></span>
                      Idle
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Queue Information Card - Only show in normal mode */}
        {!isFs && (
          <div className="w-full">
            <Card className="rounded-2xl sm:rounded-3xl border border-border/60 bg-card/90 p-4 sm:p-6 md:p-8 shadow-lg">
              <div className="space-y-4 sm:space-y-6">
                {/* Now Serving Section */}
                <div className="rounded-lg sm:rounded-2xl border border-green-500/40 bg-green-500/10 p-3 sm:p-4">
                  <p className="text-xs uppercase tracking-widest text-green-600 dark:text-green-400 font-medium">
                    Now Serving
                  </p>
                  {serving.length ? (
                    <div className="mt-3 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
                      {serving.map(({ window, ticket }) => (
                        <div
                          key={window.id}
                          className="flex items-center justify-between rounded-xl bg-card/80 p-3"
                        >
                          <span className="font-display text-2xl sm:text-3xl font-semibold text-green-600 dark:text-green-400">
                            {ticket.code}
                          </span>
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            {window.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-muted-foreground">—</p>
                  )}
                </div>

                {/* Next and Next After */}
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="rounded-lg sm:rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4">
                    <p className="text-xs uppercase tracking-widest text-amber-600 dark:text-amber-400 font-medium">
                      Next
                    </p>
                    <p className="mt-2 font-display text-xl sm:text-2xl md:text-3xl font-semibold text-amber-600 dark:text-amber-400">
                      {nextTicket?.code ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg sm:rounded-2xl border border-sky-500/40 bg-sky-500/10 p-3 sm:p-4">
                    <p className="text-xs uppercase tracking-widest text-sky-600 dark:text-sky-400 font-medium">
                      Next After
                    </p>
                    <p className="mt-2 font-display text-xl sm:text-2xl md:text-3xl font-semibold text-sky-600 dark:text-sky-400">
                      {nextAfterTicket?.code ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Waiting Queue */}
                {restTickets.length > 0 && (
                  <div className="rounded-lg sm:rounded-2xl border border-border/60 bg-background/70 p-3 sm:p-4">
                    <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground font-medium">
                      Waiting ({restTickets.length})
                    </p>
                    <ol className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {restTickets.map((entry) => (
                        <li
                          key={entry.id}
                          className="rounded-xl bg-card/80 p-3 font-medium text-foreground"
                        >
                          {entry.code}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Action Message */}
                <div className="flex items-start justify-between gap-3 rounded-lg sm:rounded-2xl border border-primary/40 bg-primary/10 p-3 sm:p-4 text-xs sm:text-sm text-primary">
                  <div>
                    <p className="text-xs uppercase tracking-widest font-medium">
                      Action
                    </p>
                    <p className="font-semibold text-sm sm:text-base">
                      {actionMessage}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

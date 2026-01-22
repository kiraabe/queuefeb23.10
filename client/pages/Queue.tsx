import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Clock4,
  Compass,
  QrCode,
  SignalHigh,
  Sparkles,
  Share2,
  Copy,
  Maximize2,
} from "lucide-react";
import QRCode from "qrcode";
import { ConsoleShell } from "@/components/layout/ConsoleShell";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSSE } from "@/hooks/use-sse";
import { apiFetch, apiUrl, resolveApiBase } from "@/lib/api";
import type {
  DisplayResponse,
  DisplayState,
  Ticket,
  WindowState,
} from "@shared/api";

const STATUS_STEPS = [
  {
    title: "Scan QR",
    description:
      "Guests unlock their live ticket from any device—no sign-in required.",
    icon: QrCode,
  },
  {
    title: "Track position",
    description:
      "Every refresh recalculates wait time using the latest throughput data.",
    icon: Clock4,
  },
  {
    title: "Get notified",
    description:
      "Highlighted alerts prompt guests when it’s time to move toward the window.",
    icon: BellRing,
  },
];

const QR_DISPLAY_MATRIX = [
  "1111011",
  "1000001",
  "1011101",
  "1010101",
  "1011101",
  "1000001",
  "1101111",
];

const FallbackQRCode = () => (
  <div className="grid grid-cols-7 gap-1 rounded-2xl bg-white p-3 shadow-inner shadow-primary/10">
    {QR_DISPLAY_MATRIX.flatMap((row, rowIndex) =>
      row
        .split("")
        .map((cell, cellIndex) => (
          <span
            key={`${rowIndex}-${cellIndex}`}
            className={cn(
              "h-2 w-2 rounded-[2px] md:h-3 md:w-3",
              cell === "1" ? "bg-foreground" : "bg-muted",
            )}
          />
        )),
    )}
  </div>
);

type QueueEntry = {
  id: string;
  code: string;
  createdAt: number;
  number: number;
};

async function getDisplay(): Promise<DisplayResponse> {
  return apiFetch("/api/display");
}
async function getWindows(): Promise<WindowState[]> {
  return apiFetch("/api/windows");
}

export default function Queue() {
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
  const [lastAlertedTicketId, setLastAlertedTicketId] = useState<string>("");
  const [blinkingTicketIds, setBlinkingTicketIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    let stop = false;
    // Prime with current server view
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

  const [sseUrl, setSseUrl] = useState<string>(() => apiUrl("/api/events"));
  useEffect(() => {
    let cancelled = false;
    resolveApiBase().then(() => {
      if (!cancelled) setSseUrl(apiUrl("/api/events"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useSSE(sseUrl, (ev) => {
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

  const serving = useMemo(() => {
    // Collect all serving tickets from windows and those proceeded to employees
    const servingMap = new Map<
      string,
      { window: WindowState | null; ticket: Ticket }
    >();

    // First, add tickets currently assigned to windows
    windows.forEach((window) => {
      if (!window.currentTicketId) return;
      const ticket = tickets[window.currentTicketId];
      // Include the entry even if ticket object is still loading
      // Use a fallback with just the ticket ID if the object isn't available yet
      if (!ticket) {
        servingMap.set(window.currentTicketId, {
          window,
          ticket: {
            id: window.currentTicketId,
            service: "S1",
            code: window.currentTicketId,
            status: "serving",
            createdAt: 0,
            number: 0,
            windowId: window.id,
          } as Ticket,
        });
      } else {
        servingMap.set(ticket.id, { window, ticket });
      }
    });

    // Then, add all other tickets with 'serving' status that aren't already in the map
    // These are tickets that have been proceeded to employees
    Object.values(tickets).forEach((ticket) => {
      if (ticket.status === "serving" && !servingMap.has(ticket.id)) {
        servingMap.set(ticket.id, {
          window: null,
          ticket,
        });
      }
    });

    return Array.from(servingMap.values());
  }, [windows, tickets]);

  // Trigger blinking when a new ticket starts serving
  useEffect(() => {
    if (serving.length > 0) {
      const newBlinkingIds = new Set<string>();
      let newAlertedId = lastAlertedTicketId;
      serving.forEach(({ ticket }) => {
        newBlinkingIds.add(ticket.id);
        if (ticket.id !== lastAlertedTicketId) {
          newAlertedId = ticket.id;
        }
      });
      setBlinkingTicketIds(newBlinkingIds);
      if (newAlertedId !== lastAlertedTicketId) {
        setLastAlertedTicketId(newAlertedId);
      }
    }
  }, [serving]);

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

    if (waitingTickets.length || !display) {
      return waitingTickets;
    }

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
    if (
      display &&
      (display.current.length > 0 || display.next || display.nextAfter)
    )
      return true;
    return false;
  }, [display, serving, waitingQueue]);

  const actionMessage =
    serving.length > 0 || (display?.current.length ?? 0) > 0
      ? "Please proceed when called"
      : "Please proceed to waiting area";

  const trackingUrl = useMemo(() => {
    if (typeof window === "undefined") return "/track";
    const origin = window.location.origin.replace(/\/$/, "");
    return `${origin}/track`;
  }, []);
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(trackingUrl, {
          margin: 1,
          width: 192,
          color: { dark: "#111111", light: "#00000000" },
        });
        if (mounted) setQrSrc(dataUrl);
      } catch {
        if (mounted) setQrSrc(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [trackingUrl]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      // optional subtle feedback via vibration
      if (navigator.vibrate) navigator.vibrate(10);
    } catch {}
  };

  const shareUrl = async () => {
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({
          title: "Live Queue",
          text: "Track the queue in real time",
          url: trackingUrl,
        });
      } else {
        await copyUrl();
      }
    } catch {}
  };

  const activateEntry = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      if (navigator.vibrate) navigator.vibrate(5);
    } catch {}
  };

  // Fullscreen view optimized for TV display
  if (isFs) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 w-full h-full bg-background overflow-hidden"
      >
        {/* Live Queue Card - Full Screen TV Optimized */}
        <div className="relative w-full h-full p-6 lg:p-12 overflow-auto flex flex-col">
          <Card className="w-full h-full border-border/60 bg-card/95 p-8 lg:p-12 shadow-2xl shadow-primary/20 overflow-hidden flex flex-col">
            <CardHeader className="space-y-4 lg:space-y-6 mb-4">
              <div className="inline-flex items-center gap-3 rounded-full bg-primary/10 px-4 py-2 text-base lg:text-xl font-semibold text-primary w-fit">
                <SignalHigh className="h-5 lg:h-6 w-5 lg:w-6" />{" "}
                {hasLiveQueue ? "Live queue synced" : "Waiting for updates"}
              </div>
              <CardTitle className="text-4xl lg:text-6xl font-bold">Live Queue</CardTitle>
              <CardDescription className="text-lg lg:text-2xl">Global first-in-first-out view</CardDescription>
            </CardHeader>
            <CardContent className="w-full space-y-6 lg:space-y-8 flex-1 overflow-auto">
              {/* Aggregated current/next list - TV Optimized */}
              <div className="w-full space-y-4 lg:space-y-6">
                <div className="w-full rounded-3xl border-3 border-green-500/50 bg-green-500/15 p-8 lg:p-10">
                  <p className="text-base lg:text-3xl uppercase tracking-wider text-green-700 font-bold">
                    Now Serving
                  </p>
                  {serving.length ? (
                    <div className="mt-8 grid gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-2 w-full">
                      {serving.map(({ window, ticket }) => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between rounded-3xl bg-card/95 p-8 lg:p-10 border-2 border-green-500/30 shadow-lg"
                        >
                          <span
                            className={cn(
                              "font-display text-6xl lg:text-8xl font-bold text-green-600",
                              blinkingTicketIds.has(ticket.id)
                                ? "animate-blink"
                                : "",
                            )}
                          >
                            {ticket.code}
                          </span>
                          <div className="text-lg lg:text-3xl text-right">
                            {window?.name ? (
                              <span className="text-muted-foreground font-bold text-lg lg:text-2xl">
                                {window.name}
                              </span>
                            ) : ticket.currentEmployee ? (
                              <div className="space-y-2">
                                <p className="font-bold text-foreground text-lg lg:text-2xl">
                                  {ticket.currentEmployee.fullName}
                                </p>
                                <p className="text-base lg:text-xl text-muted-foreground">
                                  {ticket.currentEmployee.jobTitle}
                                </p>
                                {ticket.currentEmployee.jobTitleAmharic && (
                                  <p className="text-base lg:text-xl text-muted-foreground font-semibold">
                                    {ticket.currentEmployee.jobTitleAmharic}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground font-bold text-lg lg:text-2xl">
                                Employee
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-6 text-5xl lg:text-6xl text-muted-foreground font-light">—</p>
                  )}
                </div>

                <div className="grid gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-2 w-full">
                  <div className="w-full rounded-3xl border-3 border-amber-500/50 bg-amber-500/15 p-8 lg:p-10">
                    <p className="text-base lg:text-3xl uppercase tracking-wider text-amber-700 font-bold">
                      Next
                    </p>
                    <p className="mt-6 lg:mt-8 font-display text-5xl lg:text-7xl font-bold text-foreground">
                      {nextTicket?.code ?? "—"}
                    </p>
                  </div>
                  <div className="w-full rounded-3xl border-3 border-sky-500/50 bg-sky-500/15 p-8 lg:p-10">
                    <p className="text-base lg:text-3xl uppercase tracking-wider text-sky-700 font-bold">
                      Next After
                    </p>
                    <p className="mt-6 lg:mt-8 font-display text-5xl lg:text-7xl font-bold text-foreground">
                      {nextAfterTicket?.code ?? "—"}
                    </p>
                  </div>
                </div>

                {restTickets.length > 0 && (
                    <div className="w-full rounded-3xl border-3 border-border/60 bg-background/70 p-8 lg:p-10">
                      <p className="mb-6 text-base lg:text-3xl uppercase tracking-wider text-muted-foreground font-bold">
                        Waiting Queue
                      </p>
                      <ol className="grid gap-4 lg:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 w-full">
                        {restTickets.map((entry) => (
                          <li
                            key={entry.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Ticket ${entry.code}`}
                            className="rounded-2xl bg-card/95 p-4 lg:p-6 font-bold text-2xl lg:text-4xl outline-none focus:ring-3 focus:ring-primary/60 border-2 border-border/40 cursor-pointer hover:bg-card transition-colors text-center"
                            onClick={() => activateEntry(entry.code)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                activateEntry(entry.code);
                              }
                            }}
                          >
                            {entry.code}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                <div className="w-full flex items-start justify-between gap-6 lg:gap-8 rounded-3xl border-3 border-primary/40 bg-primary/10 p-8 lg:p-10 text-base lg:text-2xl text-primary">
                  <div className="min-w-0">
                    <p className="text-base lg:text-3xl uppercase tracking-wider font-bold">
                      Action Required
                    </p>
                    <p className="font-bold text-2xl lg:text-4xl break-words mt-3 lg:mt-4">
                      {actionMessage}
                    </p>
                  </div>
                  <Sparkles className="h-7 lg:h-10 w-7 lg:w-10 flex-shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    );
  }

  // Normal view with ConsoleShell
  return (
    <div ref={containerRef} className="w-full">
      <ConsoleShell title="Virtual Queue" className="lg:grid-cols-1">
        <section className="w-full space-y-6 sm:space-y-8 md:space-y-10">
          <div className="space-y-3 sm:space-y-4 w-full flex items-start justify-between gap-4 flex-col sm:flex-row">
            <div className="space-y-3 sm:space-y-4 w-full">
              <Badge className="rounded-full border border-primary/30 bg-primary/10 px-3 sm:px-4 py-1 text-xs sm:text-sm font-medium text-primary w-fit">
                Phase 2 · Customer View
              </Badge>
              <h1 className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-semibold text-foreground tracking-tight break-words">
                A personal status hub that keeps guests relaxed and ready
              </h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFs}
              aria-pressed={isFs}
              aria-label={isFs ? "Exit full screen" : "Enter full screen"}
              className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 flex-shrink-0 whitespace-nowrap"
            >
              <Maximize2 className="mr-2 h-4 w-4" />
              {isFs ? "Exit FS" : "Full Screen"}
            </Button>
          </div>

          <div className="relative w-full">
            <div className="absolute -inset-6 sm:-inset-8 -z-10 rounded-2xl sm:rounded-[36px] bg-gradient-to-br from-primary/20 via-sky-400/10 to-indigo-500/10 blur-2xl" />
            <Card className="w-full max-w-full border-border/60 bg-card/90 p-3 sm:p-4 md:p-6 lg:p-8 shadow-2xl shadow-primary/20 overflow-hidden">
              <CardHeader className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <SignalHigh className="h-4 w-4" />{" "}
                  {hasLiveQueue ? "Live queue synced" : "Waiting for updates"}
                </div>
                <CardTitle className="text-2xl">Live Queue</CardTitle>
                <CardDescription>
                  Global first-in-first-out view
                </CardDescription>
              </CardHeader>
              <CardContent className="w-full space-y-3 sm:space-y-4">
                {/* Aggregated current/next list */}
                <div className="w-full space-y-2 sm:space-y-3">
                  <div className="w-full rounded-lg sm:rounded-2xl border border-green-500/40 bg-green-500/10 p-3 sm:p-4">
                    <p className="text-xs uppercase tracking-widest text-green-600 font-medium">
                      Now Serving
                    </p>
                    {serving.length ? (
                      <div className="mt-2 grid gap-2 grid-cols-1 sm:grid-cols-2 w-full">
                        {serving.map(({ window, ticket }) => (
                          <div
                            key={ticket.id}
                            className="flex items-center justify-between rounded-xl bg-card/80 p-3"
                          >
                            <span
                              className={cn(
                                "font-display text-2xl font-semibold",
                                blinkingTicketIds.has(ticket.id)
                                  ? "animate-blink"
                                  : "",
                              )}
                            >
                              {ticket.code}
                            </span>
                            <div className="text-sm text-right">
                              {window?.name ? (
                                <span className="text-muted-foreground">
                                  {window.name}
                                </span>
                              ) : ticket.currentEmployee ? (
                                <div className="space-y-0.5">
                                  <p className="font-medium text-foreground">
                                    {ticket.currentEmployee.fullName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {ticket.currentEmployee.jobTitle}
                                  </p>
                                  {ticket.currentEmployee.jobTitleAmharic && (
                                    <p className="text-xs text-muted-foreground font-medium">
                                      {ticket.currentEmployee.jobTitleAmharic}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">
                                  Employee
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-muted-foreground">—</p>
                    )}
                  </div>

                  <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 w-full">
                    <div className="w-full rounded-lg sm:rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4">
                      <p className="text-xs uppercase tracking-widest text-amber-600 font-medium">
                        Next
                      </p>
                      <p className="mt-2 font-display text-lg sm:text-xl md:text-2xl font-semibold">
                        {nextTicket?.code ?? "—"}
                      </p>
                    </div>
                    <div className="w-full rounded-lg sm:rounded-2xl border border-sky-500/40 bg-sky-500/10 p-3 sm:p-4">
                      <p className="text-xs uppercase tracking-widest text-sky-600 font-medium">
                        Next After
                      </p>
                      <p className="mt-2 font-display text-lg sm:text-xl md:text-2xl font-semibold">
                        {nextAfterTicket?.code ?? "—"}
                      </p>
                    </div>
                  </div>

                  {restTickets.length > 0 && (
                    <div className="w-full rounded-lg sm:rounded-2xl border border-border/60 bg-background/70 p-3 sm:p-4">
                      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground font-medium">
                        Waiting
                      </p>
                      <ol className="grid gap-2 grid-cols-1 sm:grid-cols-2 w-full">
                        {restTickets.map((entry) => (
                          <li
                            key={entry.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Ticket ${entry.code}`}
                            className="rounded-xl bg-card/80 p-3 font-medium outline-none focus:ring-2 focus:ring-primary/50"
                            onClick={() => activateEntry(entry.code)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                activateEntry(entry.code);
                              }
                            }}
                          >
                            {entry.code}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                <div className="w-full flex items-start justify-between gap-3 rounded-lg sm:rounded-2xl border border-primary/40 bg-primary/10 p-3 sm:p-4 text-xs sm:text-sm text-primary">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest font-medium">
                      Action
                    </p>
                    <p className="font-semibold text-sm sm:text-base break-words">
                      {actionMessage}
                    </p>
                  </div>
                  <Sparkles className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
                </div>

                <div className="w-full rounded-lg sm:rounded-2xl border border-border/60 bg-background/70 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    <span className="truncate">Scan anytime</span>
                    <span className="hidden sm:inline whitespace-nowrap">
                      Updates 30s
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <div className="flex flex-shrink-0 justify-center">
                      {qrSrc ? (
                        <img
                          src={qrSrc}
                          alt="Queue QR code"
                          className="h-24 w-24 rounded-xl border border-border/60 bg-white p-2 shadow-inner md:h-28 md:w-28"
                        />
                      ) : (
                        <FallbackQRCode />
                      )}
                    </div>
                    <div className="w-full space-y-2 text-xs text-muted-foreground sm:flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Tracking URL
                      </p>
                      <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap">
                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full truncate rounded-full bg-card px-3 py-1 text-center font-medium text-primary underline-offset-2 hover:underline sm:w-auto"
                        >
                          {trackingUrl}
                        </a>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyUrl}
                          className="w-full sm:w-auto"
                        >
                          <Copy className="mr-2 h-4 w-4" /> Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={shareUrl}
                          className="w-full sm:w-auto"
                        >
                          <Share2 className="mr-2 h-4 w-4" /> Share
                        </Button>
                      </div>
                      <p className="text-center sm:text-left">
                        Save to wallet or share with companions.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="w-full border-t border-border/60 bg-foreground/5 py-8 sm:py-12 md:py-16 -mx-[1rem] sm:-mx-[1.5rem] lg:-mx-[2rem] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:gap-6 md:gap-8 lg:grid-cols-3">
            {[
              "Displays mirror Now Serving",
              "Accessible fallback via concierge",
              "Multi-language prompts included",
            ].map((item) => (
              <Card
                key={item}
                className="border-border/60 bg-card/80 p-4 sm:p-6 shadow-md shadow-primary/10 hover:bg-card/90 transition-colors"
              >
                <CardHeader className="space-y-3 mb-4">
                  <Compass className="h-5 sm:h-6 w-5 sm:w-6 text-primary" />
                  <CardTitle className="text-base sm:text-lg">{item}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Guests always have a clear path forward, whether via QR
                    scans, concierge support, or immersive lobby signage.
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </ConsoleShell>
    </div>
  );
}

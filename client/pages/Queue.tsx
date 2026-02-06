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
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFs = async () => {
    try {
      if (!isFs) {
        if (!containerRef.current) {
          console.error("Container ref not available");
          return;
        }
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      // Silently handle fullscreen errors (e.g., permissions policy restrictions)
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's a permissions policy error
      if (errorMessage.includes("permissions policy") || errorMessage.includes("Disallowed")) {
        // Permissions policy prevents fullscreen - this is normal in embedded contexts
        toast({
          variant: "destructive",
          title: "Fullscreen unavailable",
          description: "Your browser or hosting environment doesn't allow fullscreen mode.",
        });
      } else {
        // Other errors - try fallback APIs
        if (!isFs && containerRef.current) {
          try {
            const elem = containerRef.current as any;
            if (elem.webkitRequestFullscreen) {
              await elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
              await elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
              await elem.msRequestFullscreen();
            }
          } catch {
            // Fallback also failed - silently ignore
          }
        }
      }
    }
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
        {/* Live Queue Card - Full Screen TV Optimized (No Scroll) */}
        <div className="relative w-full h-full p-4 lg:p-8 flex flex-col">
          <Card className="w-full h-full border-border/60 bg-card/95 p-6 lg:p-8 shadow-2xl shadow-primary/20 overflow-hidden flex flex-col">
            <CardHeader className="space-y-2 lg:space-y-3 mb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 lg:space-y-3 flex-1">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm lg:text-lg font-semibold text-primary w-fit">
                    <SignalHigh className="h-4 lg:h-5 w-4 lg:w-5" />{" "}
                    {hasLiveQueue ? "Live queue synced" : "Waiting for updates"}
                  </div>
                  <CardTitle className="text-3xl lg:text-5xl font-bold">
                    Live Queue
                  </CardTitle>
                  <CardDescription className="text-base lg:text-xl">
                    Global first-in-first-out view
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFs}
                  aria-label="Exit full screen"
                  className="whitespace-nowrap h-10 lg:h-12 px-3 lg:px-4 text-sm lg:text-base flex-shrink-0"
                >
                  <Maximize2 className="h-5 w-5 lg:h-6 lg:w-6" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="w-full space-y-3 lg:space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Aggregated current/next list - TV Optimized No Scroll */}
              <div className="w-full space-y-2 lg:space-y-3">
                <div className="w-full rounded-2xl lg:rounded-3xl border-2 lg:border-3 border-green-500/50 bg-green-500/15 p-4 lg:p-6">
                  <p className="text-sm lg:text-2xl uppercase tracking-wider text-green-700 font-bold">
                    Now Serving
                  </p>
                  {serving.length ? (
                    <div className="mt-3 lg:mt-4 grid gap-3 lg:gap-4 grid-cols-1 lg:grid-cols-2 w-full">
                      {serving.map(({ window, ticket }) => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between rounded-xl lg:rounded-2xl bg-card/95 p-3 lg:p-5 border-2 border-green-500/30"
                        >
                          <span
                            className={cn(
                              "font-display text-4xl lg:text-6xl font-bold text-green-600",
                              blinkingTicketIds.has(ticket.id)
                                ? "animate-blink"
                                : "",
                            )}
                          >
                            {ticket.code}
                          </span>
                          <div className="text-sm lg:text-xl text-right">
                            {window?.name ? (
                              <span className="text-muted-foreground font-bold text-xs lg:text-lg">
                                {window.name}
                              </span>
                            ) : ticket.currentEmployee ? (
                              <div className="space-y-0.5">
                                <p className="font-bold text-foreground text-xs lg:text-base">
                                  {ticket.currentEmployee.fullName}
                                </p>
                                <p className="text-xs lg:text-sm text-muted-foreground">
                                  {ticket.currentEmployee.jobTitle}
                                </p>
                                {ticket.currentEmployee.jobTitleAmharic && (
                                  <p className="text-xs lg:text-sm text-muted-foreground font-semibold">
                                    {ticket.currentEmployee.jobTitleAmharic}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground font-bold text-xs lg:text-lg">
                                Employee
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-2xl lg:text-4xl text-muted-foreground font-light">
                      —
                    </p>
                  )}
                </div>

                <div className="grid gap-2 lg:gap-3 grid-cols-1 lg:grid-cols-2 w-full">
                  <div className="w-full rounded-xl lg:rounded-2xl border-2 border-amber-500/50 bg-amber-500/15 p-3 lg:p-5">
                    <p className="text-xs lg:text-lg uppercase tracking-wider text-amber-700 font-bold">
                      Next
                    </p>
                    <p className="mt-2 lg:mt-3 font-display text-2xl lg:text-4xl font-bold text-foreground">
                      {nextTicket?.code ?? "—"}
                    </p>
                  </div>
                  <div className="w-full rounded-xl lg:rounded-2xl border-2 border-sky-500/50 bg-sky-500/15 p-3 lg:p-5">
                    <p className="text-xs lg:text-lg uppercase tracking-wider text-sky-700 font-bold">
                      Next After
                    </p>
                    <p className="mt-2 lg:mt-3 font-display text-2xl lg:text-4xl font-bold text-foreground">
                      {nextAfterTicket?.code ?? "—"}
                    </p>
                  </div>
                </div>

                {restTickets.length > 0 && (
                  <div className="w-full rounded-xl lg:rounded-2xl border-2 border-border/60 bg-background/70 p-3 lg:p-4">
                    <p className="mb-2 text-xs lg:text-lg uppercase tracking-wider text-muted-foreground font-bold">
                      Waiting
                    </p>
                    <ol className="grid gap-2 lg:gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 w-full">
                      {restTickets.slice(0, 12).map((entry) => (
                        <li
                          key={entry.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Ticket ${entry.code}`}
                          className="rounded-lg bg-card/95 p-2 lg:p-3 font-bold text-sm lg:text-2xl outline-none focus:ring-2 focus:ring-primary/60 border border-border/40 cursor-pointer hover:bg-card transition-colors text-center"
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

              <div className="w-full flex items-center justify-between gap-3 lg:gap-4 rounded-xl lg:rounded-2xl border-2 border-primary/40 bg-primary/10 p-3 lg:p-4 text-xs lg:text-lg text-primary">
                <div className="min-w-0">
                  <p className="text-xs lg:text-lg uppercase tracking-wider font-bold">
                    Action
                  </p>
                  <p className="font-bold text-sm lg:text-xl break-words">
                    {actionMessage}
                  </p>
                </div>
                <Sparkles className="h-5 lg:h-7 w-5 lg:w-7 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Get all unique service categories
  const allCategories = useMemo(() => {
    const categories = new Set<string>();

    // Add categories from tickets
    Object.values(tickets).forEach((t) => {
      if (t.serviceCategory) {
        categories.add(t.serviceCategory);
      }
    });

    // If no categories found, show default categories
    if (categories.size === 0) {
      return ["cadastral-group", "rights-group", "fixed-property-group"];
    }

    return Array.from(categories).sort();
  }, [tickets]);

  // Group tickets by service category
  const categoryMap = useMemo(() => {
    const map = new Map<
      string,
      {
        serving: Ticket | null;
        next: Ticket | null;
        waiting: Ticket[];
      }
    >();

    // Initialize all categories
    allCategories.forEach((category) => {
      map.set(category, { serving: null, next: null, waiting: [] });
    });

    // Add serving tickets
    serving.forEach(({ ticket }) => {
      const category = ticket.serviceCategory || "uncategorized";
      const cat = map.get(category);
      if (cat && !cat.serving) {
        cat.serving = ticket;
      }
    });

    // Add waiting tickets
    waitingQueue.forEach((entry) => {
      const ticket = tickets[entry.id];
      if (ticket) {
        const category = ticket.serviceCategory || "uncategorized";
        const cat = map.get(category);
        if (cat) {
          cat.waiting.push(ticket);
        }
      }
    });

    // Set next ticket for each category
    map.forEach((cat) => {
      if (cat.waiting.length > 0) {
        cat.next = cat.waiting[0];
      }
    });

    return map;
  }, [allCategories, tickets, waitingQueue, serving]);

  // Normal view with service cards in 2-column layout
  return (
    <div ref={containerRef} className="w-full">
      <ConsoleShell title="Virtual Queue" className="lg:grid-cols-1">
        <section className="w-full space-y-6 sm:space-y-8 md:space-y-10">
          <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-3 sm:space-y-4">
              <Badge className="rounded-full border border-primary/30 bg-primary/10 px-3 sm:px-4 py-1 text-xs sm:text-sm font-medium text-primary w-fit">
                Live · Queue Status
              </Badge>
              <h1 className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-semibold text-foreground tracking-tight">
                Queue Status Overview
              </h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFs}
              aria-pressed={isFs}
              aria-label={isFs ? "Exit full screen" : "Enter full screen"}
              className="w-auto mt-4 sm:mt-0 whitespace-nowrap"
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              {isFs ? "Exit Full Screen" : "Full Screen"}
            </Button>
          </div>

          {/* Service Category Cards Grid - 2 columns with 3rd card spanning full width */}
          <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 w-full">
            {Array.from(categoryMap.entries()).map(
              ([category, data], index) => {
                const categoryNames: Record<string, string> = {
                  "cadastral-group": "ካድስትራል",
                  "rights-group": "መብቶች",
                  "fixed-property-group": "ቋሚ ንብረት",
                };
                const displayName = categoryNames[category] || category;
                const isThirdCard = index === 2;
                return (
                  <Card
                    key={category}
                    className={`border-border/60 bg-card/90 shadow-lg overflow-hidden hover:shadow-xl transition-shadow ${isThirdCard ? "md:col-span-2" : ""}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary w-fit mb-2">
                        <SignalHigh className="h-3 w-3" /> {displayName}
                      </div>
                      <CardTitle className="text-xl">Queue Status</CardTitle>
                      <CardDescription className="text-xs">
                        Real-time statistics
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Now Serving Box */}
                      <div className="rounded-lg border-2 border-green-500/50 bg-green-500/15 p-4">
                        <p className="text-xs uppercase tracking-widest text-green-700 font-semibold">
                          Now Serving
                        </p>
                        <p
                          className={cn(
                            "mt-3 font-display text-3xl font-bold text-green-600",
                            data.serving &&
                              blinkingTicketIds.has(data.serving.id)
                              ? "animate-blink"
                              : "",
                          )}
                        >
                          {data.serving?.code ?? "—"}
                        </p>
                      </div>

                      {/* Next in Queue Box */}
                      <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/15 p-4">
                        <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
                          Next in Queue
                        </p>
                        <p className="mt-3 font-display text-3xl font-bold text-amber-600">
                          {data.next?.code ?? "—"}
                        </p>
                      </div>

                      {/* Waiting Count */}
                      <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground font-medium">
                          Waiting in Queue
                        </p>
                        <p className="mt-2 font-display text-lg font-semibold text-foreground">
                          {data.waiting.length}{" "}
                          {data.waiting.length === 1 ? "ticket" : "tickets"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              },
            )}
          </div>

          {/* QR Code and Tracking Section */}
          <Card className="border-border/60 bg-card/90 p-4 sm:p-6 lg:p-8 shadow-lg">
            <CardHeader className="space-y-3">
              <CardTitle>Track Your Ticket Anytime</CardTitle>
              <CardDescription>
                Scan the QR code or visit the tracking page to monitor your
                position
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
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
                <div className="w-full space-y-3 text-xs text-muted-foreground sm:flex-1">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </ConsoleShell>
    </div>
  );
}

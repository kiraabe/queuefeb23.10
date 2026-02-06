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

  // Fullscreen view - Split-Flap Airport Display Style
  if (isFs) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 w-screen h-screen bg-slate-950 overflow-hidden flex flex-col p-3 lg:p-4"
      >
        {/* Split-Flap Table Display */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <table className="w-full h-full border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b-4 border-yellow-400">
                <th className="border-r-4 border-yellow-400 px-4 lg:px-6 py-2 lg:py-4 text-left">
                  <span className="text-yellow-400 text-sm lg:text-xl font-black uppercase tracking-wider">SERVICE</span>
                </th>
                <th className="border-r-4 border-yellow-400 px-4 lg:px-6 py-2 lg:py-4 text-center">
                  <span className="text-yellow-400 text-sm lg:text-xl font-black uppercase tracking-wider">NOW SERVING</span>
                </th>
                <th className="border-r-4 border-yellow-400 px-4 lg:px-6 py-2 lg:py-4 text-center">
                  <span className="text-yellow-400 text-sm lg:text-xl font-black uppercase tracking-wider">NEXT</span>
                </th>
                <th className="px-4 lg:px-6 py-2 lg:py-4 text-center">
                  <span className="text-yellow-400 text-sm lg:text-xl font-black uppercase tracking-wider">WAITING</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(categoryMap.entries()).map(([category, data], index) => {
                const categoryNames: Record<string, string> = {
                  "cadastral-group": "ካድስትራል",
                  "rights-group": "መብቶች",
                  "fixed-property-group": "ቋሚ ንብረት",
                };
                const displayName = categoryNames[category] || category;
                return (
                  <tr
                    key={category}
                    className={`border-b-2 border-yellow-400 ${
                      index % 2 === 0 ? "bg-slate-900" : "bg-slate-800"
                    } hover:bg-slate-700 transition-colors`}
                  >
                    {/* Service Name Cell */}
                    <td className="border-r-4 border-yellow-400 px-4 lg:px-6 py-4 lg:py-6 text-left">
                      <div className="bg-slate-700 border-2 border-yellow-400 rounded px-3 py-2 inline-block">
                        <p className="text-yellow-300 text-lg lg:text-2xl font-black">{displayName}</p>
                      </div>
                    </td>

                    {/* Now Serving Cell */}
                    <td className="border-r-4 border-yellow-400 px-4 lg:px-6 py-4 lg:py-6 text-center">
                      <div className="bg-slate-700 border-4 border-green-400 rounded px-4 py-3 lg:px-6 lg:py-4 min-w-28 lg:min-w-40 max-h-48 overflow-y-auto">
                        {data.serving ? (
                          <div className="space-y-2">
                            <p
                              className={cn(
                                "font-display text-4xl lg:text-5xl font-black text-green-400 leading-none",
                                blinkingTicketIds.has(data.serving.id)
                                  ? "animate-blink"
                                  : "",
                              )}
                            >
                              {data.serving.code}
                            </p>
                          </div>
                        ) : (
                          <p className="font-display text-4xl lg:text-5xl font-black text-green-400 leading-none">
                            —
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Next Cell */}
                    <td className="border-r-4 border-yellow-400 px-4 lg:px-6 py-4 lg:py-6 text-center">
                      <div className="bg-slate-700 border-4 border-amber-400 rounded px-4 py-3 lg:px-6 lg:py-4 min-w-28 lg:min-w-40 max-h-48 overflow-y-auto">
                        {data.waiting.length > 0 ? (
                          <div className="space-y-2">
                            {data.waiting.slice(0, 4).map((ticket, idx) => (
                              <p key={idx} className="font-display text-2xl lg:text-4xl font-black text-amber-400 leading-none">
                                {ticket.code}
                              </p>
                            ))}
                            {data.waiting.length > 4 && (
                              <p className="font-display text-lg lg:text-2xl font-black text-amber-300 leading-none">
                                +{data.waiting.length - 4}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="font-display text-4xl lg:text-5xl font-black text-amber-400 leading-none">
                            —
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Waiting Count Cell */}
                    <td className="px-4 lg:px-6 py-4 lg:py-6 text-center">
                      <div className="bg-blue-700 border-4 border-blue-300 rounded px-4 py-3 lg:px-6 lg:py-4 inline-flex items-center justify-center min-w-28 lg:min-w-40">
                        <p className="font-display text-5xl lg:text-7xl font-black text-blue-200 leading-none">
                          {data.waiting.length}
                        </p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Normal view with service cards in 2-column layout
  return (
    <div ref={containerRef} className="min-h-screen w-full bg-background">
      <ConsoleShell title="Virtual Queue" className="lg:grid-cols-1">
        <section className="w-full space-y-6 sm:space-y-8 md:space-y-10">
          <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
            <div className="space-y-3 sm:space-y-4 flex-1">
              <Badge className="rounded-full border border-primary/30 bg-primary/10 px-3 sm:px-4 py-1 text-xs sm:text-sm font-medium text-primary w-fit">
                Live · Queue Status
              </Badge>
              <h1 className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-semibold text-foreground tracking-tight">
                Queue Status Overview
              </h1>
            </div>
            <div className="w-full sm:w-auto">
              <Button
                variant="default"
                size="sm"
                onClick={toggleFs}
                aria-pressed={isFs}
                aria-label={isFs ? "Exit full screen" : "Enter full screen"}
                className="w-full sm:w-auto whitespace-nowrap"
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                {isFs ? "Exit Full Screen" : "Full Screen"}
              </Button>
            </div>
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

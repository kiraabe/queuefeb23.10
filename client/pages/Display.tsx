import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSSE } from "@/hooks/use-sse";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  DisplayResponse,
  DisplayState,
  Ticket,
  WindowState,
} from "@shared/api";

async function getWindows(): Promise<WindowState[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  try {
    const res = await fetch("/api/windows", { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch windows: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getDisplay(): Promise<DisplayResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  try {
    const res = await fetch("/api/display", { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch display: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

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
              "h-3 w-3 rounded-[2px] md:h-4 md:w-4",
              cell === "1" ? "bg-foreground" : "bg-muted",
            )}
          />
        )),
    )}
  </div>
);

export default function Display() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Reset display data every 24 hours at midnight
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    const timer = setTimeout(() => {
      // Reload the page to refresh all display data at midnight
      window.location.reload();
    }, timeUntilMidnight);

    return () => clearTimeout(timer);
  }, []);
  const toggleFs = async () => {
    try {
      if (!isFs) await containerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  };
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [display, setDisplay] = useState<DisplayState | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  const trackingUrl = useMemo(() => {
    if (typeof window === "undefined") return "/track";
    const origin = window.location.origin.replace(/\/$/, "");
    return `${origin}/track`;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(trackingUrl, {
          margin: 1,
          width: 256,
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

  useEffect(() => {
    let stop = false;
    getWindows()
      .then((w) => !stop && setWindows(w))
      .catch((err) => {
        if (!stop) {
          console.error(
            "[Display] Failed to fetch windows:",
            err?.message || err,
          );
        }
      });
    const poll = () =>
      getDisplay()
        .then((d) => {
          if (stop) return;
          setDisplay(d.state);
        })
        .catch((err) => {
          if (!stop) {
            console.error(
              "[Display] Fetch error (will retry):",
              err?.message || err,
            );
          }
        });
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      stop = true;
      clearInterval(id);
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
      setTickets((prev) => ({ ...prev, [t.id]: t }));
    }
    if (ev.type === "display.updated") {
      setDisplay(ev.payload as DisplayState);
    }
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

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      if (navigator.vibrate) navigator.vibrate(10);
    } catch {}
  };

  const shareUrl = async () => {
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({
          title: "Track Your Ticket",
          text: "Track your queue status in real time",
          url: trackingUrl,
        });
      } else {
        await copyUrl();
      }
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full bg-background px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10"
    >
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
          Now Serving
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
      <div className="w-full grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8 sm:mb-12 md:mb-16">
        {windows.map((w) => {
          const code = windowCodes[w.id] ?? null;
          return (
            <Card
              key={w.id}
              className="rounded-2xl sm:rounded-3xl border border-border/60 bg-card/90 p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow"
              role="region"
              aria-label={`${w.name}: ${code ? `Now serving ${code}` : "Idle"}`}
            >
              <div className="text-xs sm:text-sm uppercase tracking-wide font-medium text-muted-foreground">
                {w.name}
              </div>
              <div className="mt-3 sm:mt-4 text-xl sm:text-2xl md:text-3xl font-display font-bold">
                <span className="text-green-600 dark:text-green-400">
                  {code ?? "—"}
                </span>
              </div>
              <div className="mt-2 text-xs sm:text-sm text-muted-foreground font-medium">
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

      {/* QR Code & Tracking Section */}
      <div className="w-full">
        <Card className="rounded-2xl sm:rounded-3xl border border-border/60 bg-card/90 p-4 sm:p-6 md:p-8 shadow-lg">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground mb-4 sm:mb-6">
            <span>Scan anytime</span>
            <span className="hidden sm:inline">Track your status</span>
          </div>

          {/* Responsive Layout: Stack on mobile, row on tablet+ */}
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 md:gap-8">
            {/* QR Code */}
            <div className="w-full sm:w-auto flex flex-col sm:flex-col items-center sm:items-start">
              <div className="flex-shrink-0">
                {qrSrc ? (
                  <img
                    src={qrSrc}
                    alt="Queue tracking QR code"
                    className="h-32 sm:h-40 md:h-48 w-32 sm:w-40 md:w-48 rounded-2xl border border-border/60 bg-white p-2 shadow-lg"
                  />
                ) : (
                  <div className="h-32 sm:h-40 md:h-48 w-32 sm:w-40 md:w-48 rounded-2xl border border-border/60 bg-white p-2 shadow-lg flex items-center justify-center">
                    <FallbackQRCode />
                  </div>
                )}
              </div>
              <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Guests scan to track
              </p>
            </div>

            {/* Tracking URL Section */}
            <div className="w-full sm:flex-1 space-y-3 sm:space-y-4">
              <div>
                <p className="text-xs sm:text-sm font-bold uppercase tracking-wide text-foreground mb-2">
                  Tracking URL
                </p>
                <div className="flex flex-col items-stretch sm:items-start gap-2">
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg sm:rounded-full bg-primary/10 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-primary hover:underline break-all text-center sm:text-left"
                  >
                    {trackingUrl}
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyUrl}
                  className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  <span>Copy</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={shareUrl}
                  className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  <span>Share</span>
                </Button>
              </div>

              {/* Helper Text */}
              <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border/40">
                Customers can scan this QR code or visit the tracking URL to
                check their ticket status in real time.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

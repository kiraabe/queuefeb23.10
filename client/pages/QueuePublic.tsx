import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSSE } from "@/hooks/use-sse";
import { apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DisplayState, Ticket, WindowState } from "@shared/api";

// ─── Data fetching ───────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type QueueEntry = {
  id: string;
  code: string;
  createdAt: number;
  number: number;
};

// ─── Live Clock ──────────────────────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="text-right">
      <div className="font-mono text-3xl font-bold tracking-widest text-amber-400">
        {time}
      </div>
      <div className="font-mono text-xs tracking-widest text-slate-400 uppercase mt-0.5">
        {date}
      </div>
    </div>
  );
}

// ─── Flip animation for ticket code ──────────────────────────────────────────

function TicketCode({
  code,
  size = "lg",
}: {
  code: string | null;
  size?: "lg" | "xl";
}) {
  const [displayed, setDisplayed] = useState(code);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (code === displayed) return;
    setFlipping(true);
    const t = setTimeout(() => {
      setDisplayed(code);
      setFlipping(false);
    }, 220);
    return () => clearTimeout(t);
  }, [code]);

  const sizeClass =
    size === "xl"
      ? "text-6xl sm:text-7xl md:text-8xl"
      : "text-4xl sm:text-5xl";

  return (
    <span
      className={cn(
        "font-mono font-black tracking-widest transition-all duration-200",
        sizeClass,
        flipping ? "opacity-0 scale-95" : "opacity-100 scale-100",
        displayed ? "text-amber-400" : "text-slate-600",
      )}
    >
      {displayed ?? "———"}
    </span>
  );
}

// ─── Serving row (airport departures board style) ────────────────────────────

function ServingRow({
  win,
  code,
  isFs,
}: {
  win: WindowState;
  code: string | null;
  isFs: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-slate-700/60",
        "px-4 sm:px-8",
        isFs ? "py-5 sm:py-6" : "py-3 sm:py-4",
      )}
      role="row"
      aria-label={`${win.name}: ${code ? `serving ${code}` : "idle"}`}
    >
      {/* Window label */}
      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
        <div
          className={cn(
            "flex-shrink-0 rounded font-mono font-bold tracking-widest text-center",
            "bg-slate-800 text-slate-300 border border-slate-600",
            isFs
              ? "text-base sm:text-lg px-3 py-1.5 min-w-[72px]"
              : "text-xs sm:text-sm px-2 py-1 min-w-[56px]",
          )}
        >
          {win.name}
        </div>

        {/* Status pill */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full flex-shrink-0",
              win.busy
                ? "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]"
                : "bg-slate-600",
            )}
          />
          <span
            className={cn(
              "font-mono uppercase tracking-widest",
              isFs ? "text-sm" : "text-xs",
              win.busy ? "text-emerald-400" : "text-slate-500",
            )}
          >
            {win.busy ? "SERVING" : "IDLE"}
          </span>
        </div>
      </div>

      {/* Ticket code */}
      <TicketCode code={code} size={isFs ? "xl" : "lg"} />
    </div>
  );
}

// ─── Waiting queue ticker ─────────────────────────────────────────────────────

function WaitingTicker({ entries }: { entries: QueueEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-0 overflow-hidden border-t border-slate-700/60 bg-slate-900/80">
      <div className="flex-shrink-0 bg-amber-500 px-3 sm:px-4 py-2 sm:py-3">
        <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-900">
          WAITING
        </span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div
          className="flex gap-6 sm:gap-8 px-4 sm:px-6 py-2 sm:py-3 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-xs text-slate-500">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-mono text-sm sm:text-base font-bold text-slate-200 tracking-widest">
                {entry.code}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-3 bg-slate-900/80 border-l border-slate-700/60">
        <span className="font-mono text-xs text-slate-400 tracking-widest">
          {entries.length} IN QUEUE
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  // Initial data load
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<{ state: DisplayState }>("/api/display"),
      fetchJson<WindowState[]>("/api/windows"),
    ])
      .then(([d, w]) => {
        if (cancelled) return;
        setDisplay(d.state);
        setWindows(w);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Live SSE updates
  useSSE(apiUrl("/api/events"), (ev) => {
    if (ev.type === "init") {
      const p = ev.payload as any;
      if (p.windows) setWindows(p.windows as WindowState[]);
      if (p.tickets) setTickets(p.tickets as Record<string, Ticket>);
      if (p.display) setDisplay(p.display as DisplayState);
    }
    if (ev.type === "window.updated") {
      const w = ev.payload as WindowState;
      setWindows((prev) => prev.map((x) => (x.id === w.id ? w : x)));
    }
    if (ev.type === "ticket.created" || ev.type === "ticket.updated") {
      const t = ev.payload as Ticket;
      setTickets((m) => ({ ...m, [t.id]: t }));
    }
    if (ev.type === "display.updated") {
      setDisplay(ev.payload as DisplayState);
    }
  });

  // Map each window to its current ticket code
  // NOTE: renamed loop var from `window` to `win` to avoid shadowing global window
  const windowCodes = useMemo(() => {
    const map: Record<number, string | null> = {};
    windows.forEach((win) => {
      const ticketId = win.currentTicketId;
      if (!ticketId) { map[win.id] = null; return; }

      const direct = tickets[ticketId]?.code;
      if (direct) { map[win.id] = direct; return; }

      const fromCurrent = display?.current?.find((t) => t.id === ticketId);
      const fallback =
        fromCurrent?.code ??
        (display?.next?.id === ticketId ? display.next.code : undefined) ??
        (display?.nextAfter?.id === ticketId ? display.nextAfter.code : undefined) ??
        display?.waiting.find((e) => e.id === ticketId)?.code;

      map[win.id] = fallback ?? null;
    });
    return map;
  }, [windows, tickets, display]);

  // Sorted waiting queue
  const waitingQueue = useMemo<QueueEntry[]>(() => {
    const live = Object.values(tickets)
      .filter((t) => t.status === "waiting")
      .map((t) => ({ id: t.id, code: t.code, createdAt: t.createdAt, number: t.number }))
      .sort((a, b) => a.createdAt - b.createdAt || a.number - b.number);

    if (live.length || !display) return live;

    const fallback: QueueEntry[] = [];
    const push = (e: { id: string; code: string; createdAt: number } | null | undefined) => {
      if (!e) return;
      fallback.push({ id: e.id, code: e.code, createdAt: e.createdAt, number: fallback.length });
    };
    push(display.next);
    push(display.nextAfter);
    display.waiting.forEach(push);
    return fallback;
  }, [tickets, display]);

  const [nextTicket, nextAfterTicket] = waitingQueue;

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full min-h-screen bg-slate-950 text-white flex flex-col",
        isFs && "fixed inset-0 overflow-auto",
      )}
    >
      {/* ── Header bar ── */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 bg-slate-900 border-b border-slate-700/80 flex-shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* Amber accent bar */}
          <div className="h-8 w-1 bg-amber-400 rounded-full flex-shrink-0" />
          <div>
            <h1 className="font-mono text-base sm:text-xl font-bold tracking-widest text-white uppercase">
              Service Queue
            </h1>
            <p className="font-mono text-xs text-slate-400 tracking-widest uppercase">
              Live Display
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-8">
          <LiveClock />
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFs}
            aria-pressed={isFs}
            aria-label={isFs ? "Exit full screen" : "Enter full screen"}
            className="font-mono text-xs tracking-widest uppercase border-slate-600 text-slate-300 hover:text-white hover:border-amber-400 h-8 px-3 bg-transparent"
          >
            {isFs ? "EXIT FS" : "FULLSCREEN"}
          </Button>
        </div>
      </header>

      {/* ── Now Serving board ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Column headers */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-2 bg-slate-800/60 border-b border-slate-700/40">
          <span className="font-mono text-xs tracking-[0.25em] text-slate-500 uppercase">
            Window
          </span>
          <span className="font-mono text-xs tracking-[0.25em] text-slate-500 uppercase">
            Ticket
          </span>
        </div>

        {/* Serving rows */}
        <div className="flex-1 divide-y-0" role="table" aria-label="Now serving">
          {windows.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <span className="font-mono text-slate-600 tracking-widest uppercase text-sm">
                Loading…
              </span>
            </div>
          ) : (
            windows.map((win) => (
              <ServingRow
                key={win.id}
                win={win}
                code={windowCodes[win.id] ?? null}
                isFs={isFs}
              />
            ))
          )}
        </div>

        {/* ── Next / Next After strip ── */}
        {(nextTicket || nextAfterTicket) && (
          <div className="flex items-stretch border-t border-slate-700/60 bg-slate-900/60 divide-x divide-slate-700/60">
            <div className="flex-1 px-4 sm:px-8 py-3 sm:py-4">
              <p className="font-mono text-xs tracking-[0.2em] text-amber-500 uppercase mb-1">
                Up Next
              </p>
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-amber-300">
                {nextTicket?.code ?? "—"}
              </span>
            </div>
            <div className="flex-1 px-4 sm:px-8 py-3 sm:py-4">
              <p className="font-mono text-xs tracking-[0.2em] text-slate-500 uppercase mb-1">
                After Next
              </p>
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-slate-400">
                {nextAfterTicket?.code ?? "—"}
              </span>
            </div>
          </div>
        )}

        {/* ── Waiting ticker ── */}
        <WaitingTicker entries={waitingQueue.slice(2)} />
      </div>

      {/* ── Footer ── */}
      <footer className="flex-shrink-0 px-4 sm:px-8 py-2 bg-slate-900 border-t border-slate-700/60 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-600 tracking-widest uppercase">
          Please wait until your number is called
        </span>
        <span className="font-mono text-xs text-slate-600 tracking-widest uppercase">
          {windows.filter((w) => w.busy).length}/{windows.length} windows active
        </span>
      </footer>
    </div>
  );
}
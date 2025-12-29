import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LineChart,
  Monitor,
  QrCode,
  Smartphone,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { WindowState } from "@shared/api";

// Live system stats are computed from SSE init + updates

interface PhaseHighlight {
  title: string;
  description: string;
  icon: LucideIcon;
}

const PHASES: Array<{
  phase: string;
  title: string;
  caption: string;
  highlights: PhaseHighlight[];
}> = [
  {
    phase: "Phase 1",
    title: "Reception & Virtual Ticket Issuance",
    caption:
      "Front desk teams generate QR-driven tickets instantly—no phone numbers required.",
    highlights: [
      {
        title: "Eligibility confirmed",
        description:
          "Customer arrives and an employer verifies service eligibility before proceeding.",
        icon: ClipboardCheck,
      },
      {
        title: "Generate QR ticket",
        description:
          "One click assigns ticket 015, sets service type, and calculates the queue position.",
        icon: QrCode,
      },
      {
        title: "Deliver ticket experience",
        description:
          "Print the slip or present it on-screen—customers scan to keep their queue at their fingertips.",
        icon: Smartphone,
      },
      {
        title: "Set expectations",
        description:
          "Employer confirms lounge instructions so guests know to relax until their turn arrives.",
        icon: BellRing,
      },
    ],
  },
  {
    phase: "Phase 2",
    title: "Intelligent Virtual Waiting Room",
    caption:
      "Real-time updates follow the customer anywhere on site with on-screen prompts and displays.",
    highlights: [
      {
        title: "Freedom to roam",
        description:
          "Guests get live wait-time estimates with every scan while screens broadcast current numbers.",
        icon: Users,
      },
      {
        title: "Dynamic alerts",
        description:
          "When placement shifts, the QR status nudges: ‘You’re up next—head to the waiting area.’",
        icon: CalendarClock,
      },
      {
        title: "Now serving precision",
        description:
          "The QR page switches to instructions: ‘Please proceed to Window 3 for Social Services.’",
        icon: Monitor,
      },
      {
        title: "Continuous tracking",
        description:
          "Staff dashboards visualize queue health, enabling proactive service balancing in real time.",
        icon: LineChart,
      },
    ],
  },
];

const MONITORING_OPTIONS: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
  metric: string;
}> = [
  {
    title: "QR status mini-site",
    description:
      "Scoped, ticket-specific portal refreshed with every scan—position, wait estimate, and live prompts all in one view.",
    icon: Smartphone,
    metric: "Used by 92% of guests",
  },
  {
    title: "Lobby display sync",
    description:
      "Large format dashboard mirroring ‘Now Serving’ to keep crowds informed without pulling out a device.",
    icon: Monitor,
    metric: "Latency under 2 seconds",
  },
  {
    title: "Staff alerting",
    description:
      "Reception gets notified when VIP or accessibility profiles reach the top so they can escort personally.",
    icon: BellRing,
    metric: "Zero missed calls",
  },
];

const QR_MATRIX = [
  "1111110",
  "1000001",
  "1011101",
  "1010101",
  "1011101",
  "1000001",
  "0111111",
];

const SampleQRCode = () => (
  <div className="grid grid-cols-7 gap-1 rounded-2xl bg-white p-3 shadow-inner shadow-primary/10">
    {QR_MATRIX.flatMap((row, rowIndex) =>
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

const TicketSnapshot = () => (
  <div className="relative rounded-3xl border border-border/70 bg-card/90 p-6 shadow-xl shadow-primary/10 backdrop-blur">
    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
      <span>Virtual ticket</span>
      <span>Window 3</span>
    </div>
    <div className="mt-4 flex flex-col gap-6 rounded-2xl bg-background/80 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Ticket number
          </p>
          <p className="font-display text-4xl font-semibold text-foreground">
            015
          </p>
          <p className="text-sm text-muted-foreground">
            Service: Social Security Renewal
          </p>
        </div>
        <SampleQRCode />
      </div>
      <div className="grid gap-3 text-sm">
        <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
          <span className="font-medium text-secondary-foreground">
            Position in line
          </span>
          <span className="font-display text-lg text-foreground">#4</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-accent/60 px-4 py-3">
          <span className="font-medium text-accent-foreground">
            Estimated wait
          </span>
          <span className="font-display text-lg text-foreground">
            07:45 min
          </span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3 text-sm">
          <span className="font-medium text-primary">Status</span>
          <span className="font-display text-base text-primary">
            You’re next—head to waiting area
          </span>
        </div>
      </div>
    </div>
    <div className="mt-6 rounded-2xl border border-border/70 bg-background/80 p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>Now serving</span>
        <span>Updated moments ago</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-semibold text-foreground">
        <div className="rounded-xl bg-primary/10 px-4 py-3">
          <p className="text-xs uppercase text-muted-foreground">Window 1</p>
          <p className="font-display text-lg">012</p>
        </div>
        <div className="rounded-xl bg-primary px-4 py-3 text-primary-foreground">
          <p className="text-xs uppercase text-primary-foreground/70">
            Window 2
          </p>
          <p className="font-display text-lg">013</p>
        </div>
        <div className="rounded-xl bg-primary/10 px-4 py-3">
          <p className="text-xs uppercase text-muted-foreground">Window 3</p>
          <p className="font-display text-lg">014</p>
        </div>
      </div>
    </div>
  </div>
);

const MonitoringCard = ({
  title,
  description,
  icon: Icon,
  metric,
}: (typeof MONITORING_OPTIONS)[number]) => (
  <Card className="h-full border-border/60 bg-card/80 backdrop-blur">
    <CardHeader className="space-y-4">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <CardTitle className="text-xl">{title}</CardTitle>
      <CardDescription className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </CardDescription>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="inline-flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-1 text-xs font-semibold text-secondary-foreground">
        <CheckCircle2 className="h-4 w-4" /> {metric}
      </div>
    </CardContent>
  </Card>
);

const PhaseCard = ({
  phase,
  title,
  caption,
  highlights,
}: (typeof PHASES)[number]) => (
  <Card className="h-full border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/5 backdrop-blur">
    <div className="flex items-center justify-between">
      <Badge
        variant="secondary"
        className="rounded-full border-none px-3 py-1 text-xs font-semibold"
      >
        {phase}
      </Badge>
      <QrCode className="h-6 w-6 text-primary" />
    </div>
    <h3 className="mt-5 font-display text-2xl font-semibold text-foreground">
      {title}
    </h3>
    <p className="mt-2 text-sm text-muted-foreground">{caption}</p>
    <div className="mt-6 space-y-5">
      {highlights.map(
        ({ title: itemTitle, description, icon: Icon }, index) => (
          <div
            key={itemTitle}
            className="flex items-start gap-4 rounded-2xl border border-border/60 bg-background/60 p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {index + 1}. {itemTitle}
              </p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        ),
      )}
    </div>
  </Card>
);

export default function Index() {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [waitingByService, setWaitingByService] = useState<
    Record<string, number>
  >({ S1: 0, S2: 0, S3: 0 });
  const [sseReady, setSseReady] = useState(false);

  const [tickets, setTickets] = useState<Record<string, any>>({});

  useSSE("/api/events", (ev) => {
    if (ev.type === "init") {
      setSseReady(true);
      setWindows(ev.payload.windows as WindowState[]);
      const services = ev.payload.services as Record<
        string,
        { nextNumber: number; waitingIds: string[] }
      >;
      if (services) {
        setWaitingByService({
          S1: services.S1?.waitingIds?.length || 0,
          S2: services.S2?.waitingIds?.length || 0,
          S3: services.S3?.waitingIds?.length || 0,
        });
      }
      if (ev.payload.tickets)
        setTickets(ev.payload.tickets as Record<string, any>);
    }
    if (ev.type === "window.updated") {
      const w = ev.payload as WindowState;
      setWindows((prev) =>
        prev.length ? prev.map((x) => (x.id === w.id ? w : x)) : [w],
      );
    }
    if (ev.type === "ticket.created" || ev.type === "ticket.updated") {
      const t = ev.payload as any;
      setTickets((m) => ({ ...m, [t.id]: t }));
      // Recompute waiting counts if needed when tickets change
      // We'll recalc waitingByService from tickets
      try {
        const arr = Object.values({
          ...((ev as any).payload?.tickets || tickets),
        });
        // But simpler: if ticket.status changed to waiting, increment corresponding
      } catch {}
    }
  });

  const servingCount = windows.filter((w) => Boolean(w.currentTicketId)).length;
  const waitingTotal =
    waitingByService.S1 + waitingByService.S2 + waitingByService.S3;

  return (
    <div className="relative overflow-visible">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(20,158,255,0.22),_transparent_60%)]" />
        <div className="w-full px-4 sm:px-6 lg:px-8 grid items-center gap-8 sm:gap-12 py-12 sm:py-16 md:py-20 lg:py-24 md:grid-cols-2">
          <div className="space-y-6 sm:space-y-8">
            <Badge className="w-fit rounded-full border border-primary/30 bg-primary/10 px-3 sm:px-4 py-1 text-xs sm:text-sm font-medium text-primary">
              QR-powered virtual queuing
            </Badge>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground">
              Keep your queues moving with{" "}
              <span className="bg-gradient-to-r from-primary via-sky-500 to-indigo-500 bg-clip-text text-transparent">
                QR smart tickets
              </span>
            </h1>
            <p className="max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              Fast, contactless queueing with QR tickets and live updates.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
              <Button
                asChild
                size="lg"
                className="h-11 sm:h-12 px-4 sm:px-6 text-sm sm:text-base shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
              >
                <Link
                  to="/reception"
                  className="flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <span>Launch reception console</span>
                  <ArrowRight className="h-4 sm:h-5 w-4 sm:w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats section - responsive card grid */}
        <div className="w-full border-t border-border/60 bg-foreground/5 py-8 sm:py-12">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Waiting Card */}
              <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card/90 p-4 sm:p-6 text-center hover:bg-card/95 transition-colors">
                <div className="flex items-center justify-center rounded-full bg-primary/10 text-primary h-10 sm:h-12 w-10 sm:w-12 mb-2 sm:mb-3 flex-shrink-0">
                  <Users className="h-5 sm:h-6 w-5 sm:w-6" />
                </div>
                <div className="text-xs uppercase text-muted-foreground font-medium tracking-wide">
                  Waiting
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-display font-bold text-foreground">
                  {waitingTotal ?? 0}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  across services
                </div>
              </div>

              {/* Serving Card */}
              <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card/90 p-4 sm:p-6 text-center hover:bg-card/95 transition-colors">
                <div className="flex items-center justify-center rounded-full bg-accent/10 text-accent-foreground h-10 sm:h-12 w-10 sm:w-12 mb-2 sm:mb-3 flex-shrink-0">
                  <Monitor className="h-5 sm:h-6 w-5 sm:w-6" />
                </div>
                <div className="text-xs uppercase text-muted-foreground font-medium tracking-wide">
                  Serving
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-display font-bold text-foreground">
                  {servingCount ?? 0}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  active windows
                </div>
              </div>

              {/* Served Today Card */}
              <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card/90 p-4 sm:p-6 text-center hover:bg-card/95 transition-colors">
                <div className="flex items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400 h-10 sm:h-12 w-10 sm:w-12 mb-2 sm:mb-3 flex-shrink-0">
                  <CheckCircle2 className="h-5 sm:h-6 w-5 sm:w-6" />
                </div>
                <div className="text-xs uppercase text-muted-foreground font-medium tracking-wide">
                  Served Today
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-display font-bold text-foreground">
                  {(() => {
                    const vals = Object.values(tickets || {});
                    return vals.filter((t: any) => t.status === "done").length;
                  })()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  completed
                </div>
              </div>

              {/* Avg Handling Card */}
              <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card/90 p-4 sm:p-6 text-center hover:bg-card/95 transition-colors">
                <div className="flex items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 h-10 sm:h-12 w-10 sm:w-12 mb-2 sm:mb-3 flex-shrink-0">
                  <Clock3 className="h-5 sm:h-6 w-5 sm:w-6" />
                </div>
                <div className="text-xs uppercase text-muted-foreground font-medium tracking-wide">
                  Avg handling
                </div>
                <div className="mt-2 text-3xl sm:text-4xl font-display font-bold text-foreground">
                  {(() => {
                    const vals = Object.values(tickets || {});
                    const done = vals.filter(
                      (t: any) =>
                        t.status === "done" && t.completedAt && t.startedAt,
                    );
                    if (!done.length) return "—";
                    const secs = Math.round(
                      done.reduce(
                        (a: number, b: any) =>
                          a + (b.completedAt - b.startedAt) / 1000,
                        0,
                      ) / done.length,
                    );
                    if (secs < 60) return `${secs}s`;
                    const m = Math.floor(secs / 60);
                    const r = secs % 60;
                    return r === 0 ? `${m}m` : `${m}m ${r}s`;
                  })()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">avg</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="relative border-t border-border/60 bg-foreground/5 py-8 sm:py-12 md:py-16"
      >
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              Core features
            </h2>
            <p className="mt-1 sm:mt-2 text-sm text-muted-foreground max-w-2xl">
              Key capabilities to keep lines moving and guests informed.
            </p>
          </div>

          <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-card/90 p-4 sm:p-5 hover:bg-card/95 transition-colors">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                Reception & Tickets
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Quick QR ticket issuance with guided prompts for staff.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card/90 p-4 sm:p-5 hover:bg-card/95 transition-colors">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                Virtual Waiting
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Ticket-specific status pages show live position and ETA.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card/90 p-4 sm:p-5 hover:bg-card/95 transition-colors">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                Now Serving
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Large-format lobby displays and staff dashboards for real-time
                sync.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="get-started" className="relative py-8 sm:py-10 md:py-12">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-border/60 bg-card/90 p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
            <div className="flex-1">
              <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground">
                Get started
              </h3>
              <p className="mt-1 sm:mt-2 text-sm text-muted-foreground">
                Pilot in days — templates and staff prompts included.
              </p>
            </div>
            <Button asChild className="w-full sm:w-auto flex-shrink-0 h-11">
              <Link
                to="/reception"
                className="flex items-center justify-center"
              >
                Launch reception
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

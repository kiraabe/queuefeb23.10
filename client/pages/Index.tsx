import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ClipboardCheck,
  LineChart,
  QrCode,
  Smartphone,
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
import { useAuth } from "@/hooks/use-auth";

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
  const { user } = useAuth();

  // Wait for auth to load
  if (user === undefined) return null;

  // Redirect admin users to their admin panel
  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  // Redirect employee users to their employee page
  if (user?.role === "employee") {
    return <Navigate to="/employee" replace />;
  }

  // Redirect archiever users to their archiever page
  if (user?.role === "archiever") {
    return <Navigate to="/archiever" replace />;
  }


  return (
    <div className="relative overflow-visible">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(20,158,255,0.22),_transparent_60%)]" />
        <div className="w-full px-4 sm:px-6 lg:px-8 grid items-center gap-8 sm:gap-12 py-12 sm:py-16 md:py-20 lg:py-24 md:grid-cols-2">
          <div className="space-y-6 sm:space-y-8">
            <Badge className="w-fit rounded-full border border-primary/30 bg-primary/10 px-3 sm:px-4 py-1 text-xs sm:text-sm font-medium text-primary">
              Case Tracking & Compliance
            </Badge>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground">
              Track cases and ensure{" "}
              <span className="bg-gradient-to-r from-primary via-sky-500 to-indigo-500 bg-clip-text text-transparent">
                time compliance
              </span>
            </h1>
            <p className="max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              Monitor case workflows, track employee performance, and maintain
              compliance with real-time dashboards and automated reporting.
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

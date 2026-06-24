import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
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
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";

// Live system stats are computed from SSE init + updates

interface PhaseHighlight {
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
}

interface Phase {
  phaseKey: string;
  titleKey: string;
  captionKey: string;
  highlights: PhaseHighlight[];
}

const PHASES: Phase[] = [
  {
    phaseKey: "phase1.title",
    titleKey: "phase1.title",
    captionKey: "phase1.description",
    highlights: [
      {
        titleKey: "phase1.eligibility",
        descriptionKey: "phase1.eligibilityDesc",
        icon: ClipboardCheck,
      },
      {
        titleKey: "phase1.qrTicket",
        descriptionKey: "phase1.qrTicketDesc",
        icon: QrCode,
      },
      {
        titleKey: "phase1.queueMgmt",
        descriptionKey: "phase1.queueMgmtDesc",
        icon: Monitor,
      },
      {
        titleKey: "phase1.notifications",
        descriptionKey: "phase1.notificationsDesc",
        icon: BellRing,
      },
    ],
  },
  {
    phaseKey: "phase2.title",
    titleKey: "phase2.title",
    captionKey: "phase2.description",
    highlights: [
      {
        titleKey: "phase2.documents",
        descriptionKey: "phase2.documentsDesc",
        icon: ClipboardCheck,
      },
      {
        titleKey: "phase2.compliance",
        descriptionKey: "phase2.complianceDesc",
        icon: CheckCircle2,
      },
      {
        titleKey: "phase2.archive",
        descriptionKey: "phase2.archiveDesc",
        icon: Monitor,
      },
    ],
  },
  {
    phaseKey: "phase3.title",
    titleKey: "phase3.title",
    captionKey: "phase3.description",
    highlights: [
      {
        titleKey: "phase3.ticketCall",
        descriptionKey: "phase3.ticketCallDesc",
        icon: Users,
      },
      {
        titleKey: "phase3.caseWorkflow",
        descriptionKey: "phase3.caseWorkflowDesc",
        icon: ClipboardCheck,
      },
      {
        titleKey: "phase3.analytics",
        descriptionKey: "phase3.analyticsDesc",
        icon: ArrowRight,
      },
    ],
  },
  {
    phaseKey: "phase4.title",
    titleKey: "phase4.title",
    captionKey: "phase4.description",
    highlights: [
      {
        titleKey: "phase4.caseAssignment",
        descriptionKey: "phase4.caseAssignmentDesc",
        icon: ClipboardCheck,
      },
      {
        titleKey: "phase4.workflowTracking",
        descriptionKey: "phase4.workflowTrackingDesc",
        icon: CalendarClock,
      },
      {
        titleKey: "phase4.collaboration",
        descriptionKey: "phase4.collaborationDesc",
        icon: Smartphone,
      },
      {
        titleKey: "phase4.completion",
        descriptionKey: "phase4.completionDesc",
        icon: CheckCircle2,
      },
    ],
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

const TicketSnapshot = ({ t }: { t: (key: string) => string }) => (
  <div className="relative rounded-3xl border border-border/70 bg-card/90 p-6 shadow-xl shadow-primary/10 backdrop-blur">
    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
      <span>{t("home.virtualTicket")}</span>
      <span>{t("home.window")} 3</span>
    </div>
    <div className="mt-4 flex flex-col gap-6 rounded-2xl bg-background/80 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("home.ticketNumber")}
          </p>
          <p className="font-display text-4xl font-semibold text-foreground">
            015
          </p>
          <p className="text-sm text-muted-foreground">
            {t("home.service")}
          </p>
        </div>
        <SampleQRCode />
      </div>
      <div className="grid gap-3 text-sm">
        <div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3">
          <span className="font-medium text-secondary-foreground">
            {t("home.position")}
          </span>
          <span className="font-display text-lg text-foreground">#4</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-accent/60 px-4 py-3">
          <span className="font-medium text-accent-foreground">
            {t("home.estWait")}
          </span>
          <span className="font-display text-lg text-foreground">
            07:45 min
          </span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3 text-sm">
          <span className="font-medium text-primary">{t("home.status")}</span>
          <span className="font-display text-base text-primary">
            {t("home.statusText")}
          </span>
        </div>
      </div>
    </div>
    <div className="mt-6 rounded-2xl border border-border/70 bg-background/80 p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{t("home.nowServing")}</span>
        <span>{t("home.updated")}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-semibold text-foreground">
        <div className="rounded-xl bg-primary/10 px-4 py-3">
          <p className="text-xs uppercase text-muted-foreground">{t("home.window")} 1</p>
          <p className="font-display text-lg">012</p>
        </div>
        <div className="rounded-xl bg-primary px-4 py-3 text-primary-foreground">
          <p className="text-xs uppercase text-primary-foreground/70">
            {t("home.window")} 2
          </p>
          <p className="font-display text-lg">013</p>
        </div>
        <div className="rounded-xl bg-primary/10 px-4 py-3">
          <p className="text-xs uppercase text-muted-foreground">{t("home.window")} 3</p>
          <p className="font-display text-lg">014</p>
        </div>
      </div>
    </div>
  </div>
);

const PhaseCard = ({ t }: { t: (key: string) => string }) => {
  return ({ phaseKey, titleKey, captionKey, highlights }: Phase) => (
    <Card className="h-full border-border/60 bg-card/80 p-6 shadow-lg shadow-primary/5 backdrop-blur">
      <div className="flex items-center justify-between">
        <Badge
          variant="secondary"
          className="rounded-full border-none px-3 py-1 text-xs font-semibold"
        >
          {t(phaseKey)}
        </Badge>
        <QrCode className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-5 font-display text-2xl font-semibold text-foreground">
        {t(titleKey)}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{t(captionKey)}</p>
      <div className="mt-6 space-y-5">
        {highlights.map(
          ({ titleKey: itemTitleKey, descriptionKey, icon: Icon }, index) => (
            <div
              key={itemTitleKey}
              className="flex items-start gap-4 rounded-2xl border border-border/60 bg-background/60 p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {index + 1}. {t(itemTitleKey)}
                </p>
                <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
              </div>
            </div>
          ),
        )}
      </div>
    </Card>
  );
};

export default function Index() {
  const { user } = useAuth();
  const { t } = useTranslation();

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
        <div className="absolute inset-0 -z-10 bg-blue-50" />
        <div className="w-full px-4 sm:px-6 lg:px-8 grid items-center gap-8 sm:gap-12 py-12 sm:py-16 md:py-20 lg:py-24 md:grid-cols-2">
          <div className="space-y-6 sm:space-y-8">
            <Badge className="w-fit rounded-full border border-primary/30 bg-primary/10 px-3 sm:px-4 py-1 text-xs sm:text-sm font-medium text-primary">
              {t("home.badgeText")}
            </Badge>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground">
              {t("home.heroTitle")}{" "}
              <span className="bg-gradient-to-r from-primary via-sky-500 to-indigo-500 bg-clip-text text-transparent">
                {t("home.heroTitleSpan")}
              </span>
            </h1>
            <p className="max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              {t("home.heroDesc")}
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
                  <span>{t("home.launchBtn")}</span>
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
              {t("home.coreFeatures")}
            </h2>
            <p className="mt-1 sm:mt-2 text-sm text-muted-foreground max-w-2xl">
              {t("home.featuresSubtitle")}
            </p>
          </div>

          <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-card/90 p-4 sm:p-5 hover:bg-card/95 transition-colors">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                {t("home.feat1Title")}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {t("home.feat1Desc")}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card/90 p-4 sm:p-5 hover:bg-card/95 transition-colors">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                {t("home.feat2Title")}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {t("home.feat2Desc")}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card/90 p-4 sm:p-5 hover:bg-card/95 transition-colors">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                {t("home.feat3Title")}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {t("home.feat3Desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-border/60 bg-foreground/5 py-8 sm:py-12 md:py-16">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start mb-8 sm:mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
              {t("home.workflowPhases")}
            </h2>
            <p className="mt-1 sm:mt-2 text-sm text-muted-foreground max-w-2xl">
              {t("home.workflowSubtitle")}
            </p>
          </div>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
            {PHASES.map((phase) => {
              const Card = PhaseCard({ t });
              return <div key={phase.phaseKey}>{Card(phase)}</div>;
            })}
          </div>
        </div>
      </section>

    </div>
  );
}

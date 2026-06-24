import { useEffect, useState, useMemo } from "react";
import { useSSE } from "@/hooks/use-sse";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch, apiUrl } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Clock,
  Users,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  SkipForward,
  PauseCircle,
  Award,
  Briefcase,
  Activity,
  BarChart3,
  CalendarDays,
  Monitor,
  ChevronRight,
  Circle,
} from "lucide-react";
import type {
  QueueSnapshot,
  WindowState,
  Ticket,
  DisplayState,
} from "@shared/api";
import DailyReportViewer from "./DailyReportViewer";
import EmployeePerformanceDashboard from "./EmployeePerformanceDashboard";
import CaseWorkflowTracker from "./CaseWorkflowTracker";
import EmployeeCaseQueue from "./EmployeeCaseQueue";
import ServiceCategoryAnalytics from "./ServiceCategoryAnalytics";
import OverallEmployeeAnalytics from "./OverallEmployeeAnalytics";
import OverallCategoryAnalytics from "./OverallCategoryAnalytics";

interface DashboardStats {
  totalWaiting: number;
  totalServing: number;
  servedToday: number;
  skippedToday: number;
  holdToday: number;
  averageHandlingTime: number | null;
  longestWaitTime: number | null;
  averageWaitTime: number | null;
  totalTicketsCreatedToday: number;
  completionRate: number;
  systemHealth: "healthy" | "warning" | "critical";
  totalCompleted: number;
}

interface EmployeeStats {
  totalEmployees: number;
  totalCases: number;
  topPerformer: string;
  avgDuration: number | null;
}

// ─── Accent-bordered stat card ────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ElementType;
  accent: "blue" | "green" | "yellow" | "orange" | "purple" | "emerald" | "gray" | "red";
  tooltip?: React.ReactNode;
}) {
  const accentMap: Record<string, { border: string; iconBg: string; icon: string }> = {
    blue: { border: "border-l-blue-500", iconBg: "bg-blue-50", icon: "text-blue-600" },
    green: { border: "border-l-green-500", iconBg: "bg-green-50", icon: "text-green-600" },
    yellow: { border: "border-l-yellow-500", iconBg: "bg-yellow-50", icon: "text-yellow-600" },
    orange: { border: "border-l-orange-500", iconBg: "bg-orange-50", icon: "text-orange-600" },
    purple: { border: "border-l-purple-500", iconBg: "bg-purple-50", icon: "text-purple-600" },
    emerald: { border: "border-l-emerald-500", iconBg: "bg-emerald-50", icon: "text-emerald-600" },
    gray: { border: "border-l-slate-400", iconBg: "bg-slate-50", icon: "text-slate-500" },
    red: { border: "border-l-red-500", iconBg: "bg-red-50", icon: "text-red-600" },
  };

  const a = accentMap[accent];

  const content = (
    <div
      className={`group relative flex flex-col gap-3 rounded-xl border border-l-4 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-default ${a.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </span>
        <div className={`rounded-lg p-1.5 ${a.iconBg}`}>
          <Icon className={`h-4 w-4 ${a.icon}`} />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-900 leading-none">
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );

  if (!tooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent className="max-w-[220px]">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ─── Section header with eyebrow label ────────────────────────────────────────
function SectionHeader({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">
          {eyebrow}
        </p>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [display, setDisplay] = useState<DisplayState | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [analyticsView, setAnalyticsView] = useState<"overall" | "daily">("overall");
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats>({
    totalEmployees: 0,
    totalCases: 0,
    topPerformer: "N/A",
    avgDuration: null,
  });

  const sseUrl = apiUrl("/api/events");
  useSSE(sseUrl, (event) => {
    setLastUpdate(Date.now());
    if (event.type === "init") {
      const snapshot = event.payload as QueueSnapshot;
      setWindows(snapshot.windows);
      setTickets(snapshot.tickets);
      setDisplay(snapshot.display);
    } else if (event.type === "window.updated") {
      setWindows((prev) =>
        prev.map((w) =>
          w.id === (event.payload as WindowState).id
            ? (event.payload as WindowState)
            : w,
        ),
      );
    } else if (event.type === "ticket.created" || event.type === "ticket.updated") {
      const ticket = event.payload as Ticket;
      setTickets((prev) => ({ ...prev, [ticket.id]: ticket }));
    } else if (event.type === "display.updated") {
      setDisplay(event.payload as DisplayState);
    }
  });

  useEffect(() => {
    const fetchEmployeeStats = async () => {
      try {
        const data = await apiFetch<any>("/api/admin/employee-stats");
        setEmployeeStats({
          totalEmployees: data.totalEmployees || 0,
          totalCases: data.totalCases || 0,
          topPerformer: data.topPerformer || "N/A",
          avgDuration: data.avgDuration || null,
        });
      } catch (error) {
        console.debug("[AdminDashboard] Failed to fetch employee stats:", error);
      }
    };
    fetchEmployeeStats();
    const interval = setInterval(fetchEmployeeStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo((): DashboardStats => {
    const ticketList = Object.values(tickets);
    const now = Date.now();

    const waiting = ticketList.filter((t) => t.status === "waiting");
    const serving = ticketList.filter((t) => t.status === "serving");
    const completed = ticketList.filter((t) => t.status === "done");

    const todayTickets = ticketList.filter((t) => {
      const ticketDate = new Date(t.createdAt).toDateString();
      const today = new Date(now).toDateString();
      return ticketDate === today;
    });

    const completedWithTiming = completed.filter((t) => t.startedAt && t.completedAt);
    const servingTimes = completedWithTiming.map((t) => (t.completedAt! - t.startedAt!) / 1000);
    const avgHandlingTime =
      servingTimes.length > 0
        ? Math.round(servingTimes.reduce((a, b) => a + b, 0) / servingTimes.length)
        : null;

    const allTicketsWithWaitTime = ticketList.filter((t) => t.createdAt && t.startedAt);
    const allWaitTimes = allTicketsWithWaitTime.map((t) => (t.startedAt! - t.createdAt) / 1000);
    const currentWaitingTimes = waiting.map((t) => (now - t.createdAt) / 1000);
    const allWaitsForLongestCalc = [...allWaitTimes, ...currentWaitingTimes];
    const longestWait =
      allWaitsForLongestCalc.length > 0 ? Math.round(Math.max(...allWaitsForLongestCalc)) : null;
    const avgWait =
      allWaitTimes.length > 0
        ? Math.round(allWaitTimes.reduce((a, b) => a + b, 0) / allWaitTimes.length)
        : null;

    let health: DashboardStats["systemHealth"] = "healthy";
    if (longestWait && longestWait > 3600) health = "critical";
    else if (longestWait && longestWait > 1800) health = "warning";

    const servedCount = todayTickets.filter((t) => t.status === "done").length;
    const completionRate =
      todayTickets.length > 0 ? Math.round((servedCount / todayTickets.length) * 100) : 0;

    return {
      totalWaiting: waiting.length,
      totalServing: serving.length,
      servedToday: servedCount,
      skippedToday: todayTickets.filter((t) => t.status === "skipped").length,
      holdToday: todayTickets.filter((t) => t.status === "transferred").length,
      averageHandlingTime: avgHandlingTime,
      longestWaitTime: longestWait,
      averageWaitTime: avgWait,
      totalTicketsCreatedToday: todayTickets.length,
      completionRate,
      systemHealth: health,
      totalCompleted: completed.length,
    };
  }, [tickets]);

  const formatSeconds = (seconds: number | null) => {
    if (seconds === null) return "—";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const healthConfig = {
    healthy: {
      dot: "bg-green-500",
      label: "Healthy",
      badge: "bg-green-50 text-green-700 border-green-200",
      banner: null,
    },
    warning: {
      dot: "bg-yellow-500 animate-pulse",
      label: "Warning",
      badge: "bg-yellow-50 text-yellow-700 border-yellow-200",
      banner: {
        bg: "bg-amber-50 border-amber-200",
        icon: "text-amber-600",
        text: "text-amber-800",
        msg: `Wait time is elevated at ${formatSeconds(stats.longestWaitTime)}. Monitor queue closely.`,
      },
    },
    critical: {
      dot: "bg-red-500 animate-pulse",
      label: "Critical",
      badge: "bg-red-50 text-red-700 border-red-200",
      banner: {
        bg: "bg-red-50 border-red-200",
        icon: "text-red-600",
        text: "text-red-800",
        msg: `Longest wait is ${formatSeconds(stats.longestWaitTime)}. Open additional service windows immediately.`,
      },
    },
  };

  const hc = healthConfig[stats.systemHealth];

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto max-w-screen-2xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-5 w-5 text-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                Operations
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Real-time queue monitoring and performance analytics
            </p>
          </div>

          {/* Live status pill */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${hc.badge}`}>
              <span className={`h-2 w-2 rounded-full ${hc.dot}`} />
              System {hc.label}
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-500 shadow-sm">
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
              Live
            </div>
          </div>
        </div>

        {/* ── Health banner (when not healthy) ────────────────────────────── */}
        {hc.banner && (
          <div className={`flex items-start gap-3 rounded-xl border p-4 ${hc.banner.bg}`}>
            <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${hc.banner.icon}`} />
            <p className={`text-sm font-medium ${hc.banner.text}`}>{hc.banner.msg}</p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1 · Workforce Overview
        ════════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            eyebrow="Workforce"
            title="Team Overview"
            description="Staff capacity and all-time case activity"
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Employees"
              value={employeeStats.totalEmployees}
              sub="active staff"
              icon={Users}
              accent="blue"
              tooltip={<p className="text-xs">Total active staff members in the system</p>}
            />
            <StatCard
              label="Cases Completed"
              value={stats.totalCompleted.toLocaleString()}
              sub="all time"
              icon={Briefcase}
              accent="green"
              tooltip={<p className="text-xs">Total tickets resolved since system start</p>}
            />
            <StatCard
              label="Top Performer"
              value={
                <span className="text-2xl truncate block max-w-full">
                  {employeeStats.topPerformer}
                </span>
              }
              sub="by case count"
              icon={Award}
              accent="yellow"
            />
            <StatCard
              label="Avg Case Duration"
              value={formatSeconds(employeeStats.avgDuration)}
              sub="per employee"
              icon={Clock}
              accent="orange"
              tooltip={<p className="text-xs">Average time each employee spends per case</p>}
            />
            <StatCard
              label="Service Windows"
              value={windows.length}
              sub="total available"
              icon={Monitor}
              accent="purple"
              tooltip={<p className="text-xs">Total service windows configured in the system</p>}
            />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2 · Live Queue Status
        ════════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            eyebrow="Live Queue"
            title="Today's Activity"
            description="Current queue state and today's throughput"
          />

          {/* Top row: live counts */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-4">
            <StatCard
              label="Waiting"
              value={stats.totalWaiting}
              sub="in queue now"
              icon={Users}
              accent="blue"
            />
            <StatCard
              label="Serving"
              value={stats.totalServing}
              sub="active now"
              icon={Zap}
              accent="green"
            />
            <StatCard
              label="Served Today"
              value={stats.servedToday}
              sub="completed"
              icon={CheckCircle2}
              accent="emerald"
            />
            <StatCard
              label="Completion"
              value={`${stats.completionRate}%`}
              sub="of today's tickets"
              icon={TrendingUp}
              accent="green"
              tooltip={
                <div className="space-y-1 text-xs">
                  <p className="font-semibold">Completion Rate</p>
                  <p>Served ÷ total tickets created today</p>
                </div>
              }
            />
            <StatCard
              label="Skipped"
              value={stats.skippedToday}
              sub="today"
              icon={SkipForward}
              accent="yellow"
            />
            <StatCard
              label="On Hold"
              value={stats.holdToday}
              sub="today"
              icon={PauseCircle}
              accent="orange"
            />
          </div>

          {/* Completion rate bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-700">Today's Throughput</span>
              <span className="text-sm font-bold text-slate-900">
                {stats.servedToday} / {stats.totalTicketsCreatedToday} tickets
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>0%</span>
              <span className="font-medium text-slate-600">{stats.completionRate}% complete</span>
              <span>100%</span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 3 · Performance Metrics
        ════════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            eyebrow="Performance"
            title="Service Timing"
            description="Handling and wait time benchmarks across all tickets"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Avg Handling Time"
              value={formatSeconds(stats.averageHandlingTime)}
              sub="per completed ticket"
              icon={Clock}
              accent="blue"
              tooltip={
                <p className="text-xs">
                  Average time from when serving starts to case completion
                </p>
              }
            />
            <StatCard
              label="Longest Wait"
              value={formatSeconds(stats.longestWaitTime)}
              sub="current or historical"
              icon={TrendingUp}
              accent={stats.systemHealth === "critical" ? "red" : stats.systemHealth === "warning" ? "orange" : "gray"}
              tooltip={
                <div className="space-y-2 text-xs">
                  <p className="font-semibold">Longest Wait Time</p>
                  <p>🟢 Under 30 min — Healthy</p>
                  <p>🟡 30–60 min — Warning</p>
                  <p>🔴 Over 60 min — Critical</p>
                </div>
              }
            />
            <StatCard
              label="Avg Wait Time"
              value={formatSeconds(stats.averageWaitTime)}
              sub="across all tickets"
              icon={Clock}
              accent="gray"
              tooltip={
                <p className="text-xs">
                  Average time customers spend waiting before being called
                </p>
              }
            />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 4 · Live Display Board
        ════════════════════════════════════════════════════════════════════ */}
        {display && (
          <section>
            <SectionHeader
              eyebrow="Display Board"
              title="Now Serving"
              description="Live state of the customer-facing display"
            />

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <Tabs defaultValue="current" className="w-full">
                <div className="border-b border-slate-100 px-4 pt-1">
                  <TabsList className="h-10 bg-transparent gap-0 p-0">
                    {[
                      { value: "current", label: "Now Serving" },
                      { value: "next", label: "Up Next" },
                      { value: "queue", label: "Queue Preview" },
                    ].map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="h-10 rounded-none border-b-2 border-transparent px-4 text-sm font-medium text-slate-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* Now Serving */}
                <TabsContent value="current" className="p-5 mt-0">
                  {display.current.length > 0 ? (
                    <div className="space-y-3">
                      {display.current.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-xl border border-green-100 bg-green-50/50 p-5"
                        >
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-green-600 mb-1">
                              Now Serving
                            </p>
                            <p className="text-5xl font-black tracking-tight text-green-700 leading-none">
                              {ticket.code}
                            </p>
                            {ticket.ownerName && (
                              <p className="mt-2 text-sm font-medium text-slate-700">
                                {ticket.ownerName}
                              </p>
                            )}
                            <p className="mt-1 text-sm text-slate-500">
                              {ticket.service}
                            </p>
                            {ticket.selectedServices && ticket.selectedServices.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {ticket.selectedServices.map((s, i) => (
                                  <span
                                    key={i}
                                    className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {ticket.currentEmployee && (
                            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-right shadow-sm min-w-[160px]">
                              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">
                                Handler
                              </p>
                              <p className="text-base font-bold text-slate-900">
                                {ticket.currentEmployee.fullName}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {ticket.currentEmployee.jobTitleAmharic ||
                                  ticket.currentEmployee.jobTitle}
                              </p>
                              {ticket.windowId && (
                                <p className="text-xs text-blue-600 mt-1.5 font-medium">
                                  {ticket.windowId}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="rounded-full bg-slate-100 p-4 mb-3">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-500">No one is being served right now</p>
                    </div>
                  )}
                </TabsContent>

                {/* Up Next */}
                <TabsContent value="next" className="p-5 mt-0">
                  {(() => {
                    const nextTickets = [display.next, display.nextAfter].filter(Boolean);
                    return nextTickets.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {nextTickets.map((ticket, index) => (
                          <div
                            key={ticket?.id || index}
                            className="rounded-xl border border-blue-100 bg-blue-50/40 p-5"
                          >
                            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">
                              {index === 0 ? "Next" : "After Next"}
                            </p>
                            <p className="text-4xl font-black tracking-tight text-blue-700 leading-none">
                              {ticket?.code}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">{ticket?.service}</p>
                            {ticket?.currentEmployee && (
                              <div className="mt-3 pt-3 border-t border-blue-100">
                                <p className="text-xs text-slate-500">
                                  Handler:{" "}
                                  <span className="font-semibold text-slate-700">
                                    {ticket.currentEmployee.fullName}
                                  </span>
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-sm text-slate-500">No upcoming tickets</p>
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* Queue Preview */}
                <TabsContent value="queue" className="p-5 mt-0">
                  {(() => {
                    const allWaitingTickets = Object.values(tickets).filter(
                      (t) => t.status === "waiting",
                    );
                    if (allWaitingTickets.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="rounded-full bg-green-100 p-4 mb-3">
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">Queue is clear</p>
                          <p className="text-xs text-slate-400 mt-1">No customers waiting</p>
                        </div>
                      );
                    }

                    const grouped = allWaitingTickets.reduce(
                      (acc, ticket) => {
                        const cat = ticket.service || "Other";
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(ticket);
                        return acc;
                      },
                      {} as Record<string, Ticket[]>,
                    );

                    return (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">
                            {allWaitingTickets.length} customer{allWaitingTickets.length !== 1 ? "s" : ""} waiting
                          </p>
                          <span className="text-xs text-slate-400">
                            across {Object.keys(grouped).length} service{Object.keys(grouped).length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {Object.entries(grouped).map(([category, categoryTickets]) => (
                          <div key={category}>
                            <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 mb-2">
                              <p className="text-sm font-semibold text-slate-700">{category}</p>
                              <Badge variant="secondary" className="text-xs">
                                {categoryTickets.length}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                              {categoryTickets.map((ticket) => (
                                <div
                                  key={ticket.id}
                                  className="rounded-lg border border-slate-200 bg-white p-2.5 text-center hover:border-blue-300 hover:shadow-sm transition-all"
                                >
                                  <p className="font-bold text-slate-900 text-sm">{ticket.code}</p>
                                  {ticket.ownerName && (
                                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                                      {ticket.ownerName}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 5 · Daily Report
        ════════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            eyebrow="Reporting"
            title="Daily Report"
          />
          <DailyReportViewer />
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 6 · Advanced Analytics
        ════════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader
            eyebrow="Analytics"
            title="Advanced Analytics"
            description="Comprehensive metrics for performance tracking and trend analysis"
            right={
              <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm gap-1">
                <button
                  onClick={() => setAnalyticsView("overall")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${analyticsView === "overall"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">All-Time</span>
                </button>
                <button
                  onClick={() => setAnalyticsView("daily")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${analyticsView === "daily"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Daily</span>
                </button>
              </div>
            }
          />

          {analyticsView === "overall" ? (
            <div className="space-y-8">
              <OverallEmployeeAnalytics />
              <OverallCategoryAnalytics />
              <CaseWorkflowTracker defaultTimeframe="all-time" />
            </div>
          ) : (
            <div className="space-y-8">
              <EmployeePerformanceDashboard />
              <ServiceCategoryAnalytics />
              <EmployeeCaseQueue />
              <CaseWorkflowTracker />
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
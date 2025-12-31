import { useEffect, useState, useMemo } from "react";
import { useSSE } from "@/hooks/use-sse";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Users,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  SkipForward,
  ArrowRightLeft,
} from "lucide-react";
import type {
  QueueSnapshot,
  WindowState,
  Ticket,
  DisplayState,
} from "@shared/api";
import { format } from "date-fns";
import DailyReportViewer from "./DailyReportViewer";
import EmployeePerformanceDashboard from "./EmployeePerformanceDashboard";
import CaseWorkflowTracker from "./CaseWorkflowTracker";
import EmployeeCaseQueue from "./EmployeeCaseQueue";
import ServiceCategoryAnalytics from "./ServiceCategoryAnalytics";

interface DashboardStats {
  totalWaiting: number;
  totalServing: number;
  servedToday: number;
  skippedToday: number;
  transferredToday: number;
  averageHandlingTime: number | null;
  longestWaitTime: number | null;
  averageWaitTime: number | null;
  totalTicketsCreatedToday: number;
  activeWindows: number;
  systemHealth: "healthy" | "warning" | "critical";
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [display, setDisplay] = useState<DisplayState | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const sseUrl = "/api/events";
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
    } else if (
      event.type === "ticket.created" ||
      event.type === "ticket.updated"
    ) {
      const ticket = event.payload as Ticket;
      setTickets((prev) => ({ ...prev, [ticket.id]: ticket }));
    } else if (event.type === "display.updated") {
      setDisplay(event.payload as DisplayState);
    }
  });

  const stats = useMemo((): DashboardStats => {
    const ticketList = Object.values(tickets);
    const now = Date.now();

    // Aggregate stats
    const waiting = ticketList.filter((t) => t.status === "waiting");
    const serving = ticketList.filter((t) => t.status === "serving");
    const completed = ticketList.filter((t) => t.status === "done");
    const skipped = ticketList.filter((t) => t.status === "skipped");
    const transferred = ticketList.filter((t) => t.status === "transferred");

    // Today's tickets (created after midnight UTC)
    const todayTickets = ticketList.filter((t) => {
      const ticketDate = new Date(t.createdAt).toDateString();
      const today = new Date(now).toDateString();
      return ticketDate === today;
    });

    // Serving time calculations
    const completedWithTiming = completed.filter(
      (t) => t.startedAt && t.completedAt,
    );
    const servingTimes = completedWithTiming.map(
      (t) => (t.completedAt! - t.startedAt!) / 1000,
    );
    const avgHandlingTime =
      servingTimes.length > 0
        ? Math.round(
            servingTimes.reduce((a, b) => a + b, 0) / servingTimes.length,
          )
        : null;

    // Wait time calculations
    const waitingTimes = waiting.map((t) => (now - t.createdAt) / 1000);
    const longestWait =
      waitingTimes.length > 0 ? Math.round(Math.max(...waitingTimes)) : null;
    const avgWait =
      waitingTimes.length > 0
        ? Math.round(
            waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length,
          )
        : null;

    // System health
    let health: DashboardStats["systemHealth"] = "healthy";
    if (longestWait && longestWait > 3600) health = "critical";
    else if (longestWait && longestWait > 1800) health = "warning";

    const activeWindowCount = windows.filter((w) => w.busy).length;

    return {
      totalWaiting: waiting.length,
      totalServing: serving.length,
      servedToday: todayTickets.filter((t) => t.status === "done").length,
      skippedToday: todayTickets.filter((t) => t.status === "skipped").length,
      transferredToday: todayTickets.filter((t) => t.status === "transferred")
        .length,
      averageHandlingTime: avgHandlingTime,
      longestWaitTime: longestWait,
      averageWaitTime: avgWait,
      totalTicketsCreatedToday: todayTickets.length,
      activeWindows: activeWindowCount,
      systemHealth: health,
    };
  }, [tickets]);

  const formatSeconds = (seconds: number | null) => {
    if (seconds === null) return "N/A";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const healthBadgeColor =
    stats.systemHealth === "healthy"
      ? "bg-green-100 text-green-800"
      : stats.systemHealth === "warning"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <div className="space-y-6">
      {/* Health Alert */}
      {stats.systemHealth !== "healthy" && (
        <Alert variant="default" className="border-orange-500 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            {stats.systemHealth === "critical"
              ? `⚠️ Critical: Longest wait time is ${formatSeconds(stats.longestWaitTime)}. Consider opening additional windows.`
              : `⚠️ Warning: Longest wait time is ${formatSeconds(stats.longestWaitTime)}. Monitor queue status closely.`}
          </AlertDescription>
        </Alert>
      )}

      {/* System Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Status</CardTitle>
              <CardDescription>
                Real-time system health and activity
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={healthBadgeColor}>
                {stats.systemHealth === "healthy"
                  ? "✓ Healthy"
                  : stats.systemHealth === "warning"
                    ? "⚠ Warning"
                    : "✕ Critical"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Updated: {format(lastUpdate, "HH:mm:ss")}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Waiting */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Waiting
                </span>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{stats.totalWaiting}</p>
              <p className="text-xs text-muted-foreground">
                customers in queue
              </p>
            </div>

            {/* Serving */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Serving
                </span>
                <Zap className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold">{stats.totalServing}</p>
              <p className="text-xs text-muted-foreground">active windows</p>
            </div>

            {/* Served Today */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Served Today
                </span>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold">{stats.servedToday}</p>
              <p className="text-xs text-muted-foreground">
                of {stats.totalTicketsCreatedToday} tickets
              </p>
            </div>

            {/* Active Windows */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Active Windows
                </span>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-2xl font-bold">{stats.activeWindows}</p>
              <p className="text-xs text-muted-foreground">
                of {windows.length} windows
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>Service timing and queue statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Avg Handling Time */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Avg Handling Time
                </span>
              </div>
              <p className="text-2xl font-bold">
                {formatSeconds(stats.averageHandlingTime)}
              </p>
              <p className="text-xs text-muted-foreground">
                per completed ticket
              </p>
            </div>

            {/* Longest Wait */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Longest Wait
                </span>
              </div>
              <p className="text-2xl font-bold">
                {formatSeconds(stats.longestWaitTime)}
              </p>
              <p className="text-xs text-muted-foreground">current customer</p>
            </div>

            {/* Avg Wait Time */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Avg Wait Time
                </span>
              </div>
              <p className="text-2xl font-bold">
                {formatSeconds(stats.averageWaitTime)}
              </p>
              <p className="text-xs text-muted-foreground">queue average</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Actions</CardTitle>
          <CardDescription>Today's ticket operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Skipped */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <SkipForward className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Skipped
                </span>
              </div>
              <p className="text-2xl font-bold">{stats.skippedToday}</p>
              <p className="text-xs text-muted-foreground">tickets</p>
            </div>

            {/* Transferred */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-muted-foreground">
                  Transferred
                </span>
              </div>
              <p className="text-2xl font-bold">{stats.transferredToday}</p>
              <p className="text-xs text-muted-foreground">tickets</p>
            </div>

            {/* Completion Rate */}
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-muted-foreground">
                  Completion Rate
                </span>
              </div>
              <p className="text-2xl font-bold">
                {stats.totalTicketsCreatedToday > 0
                  ? Math.round(
                      (stats.servedToday / stats.totalTicketsCreatedToday) *
                        100,
                    )
                  : 0}
                %
              </p>
              <p className="text-xs text-muted-foreground">
                of today's tickets
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Display State */}
      {display && (
        <Card>
          <CardHeader>
            <CardTitle>Current Display State</CardTitle>
            <CardDescription>Live display board information</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="current" className="w-full">
              <TabsList>
                <TabsTrigger value="current">Now Serving</TabsTrigger>
                <TabsTrigger value="next">Next</TabsTrigger>
                <TabsTrigger value="queue">Queue Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="space-y-4">
                {display.current.length > 0 ? (
                  <div className="space-y-3">
                    {display.current.map((ticket) => (
                      <div key={ticket.id} className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">
                          Now Serving
                        </p>
                        <p className="text-3xl font-bold text-green-600">
                          {ticket.code}
                        </p>
                        <p className="mt-2 text-sm">
                          Window: {ticket.windowId || "Employee"} | Service:{" "}
                          {ticket.service}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border p-4 text-center text-muted-foreground">
                    No customer currently being served
                  </div>
                )}
              </TabsContent>

              <TabsContent value="next" className="space-y-4">
                {display.next ? (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Next Ticket</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {display.next.code}
                    </p>
                    <p className="mt-2 text-sm">
                      Service: {display.next.service}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border p-4 text-center text-muted-foreground">
                    No next ticket
                  </div>
                )}
              </TabsContent>

              <TabsContent value="queue" className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Queue Overview ({display.waiting.length} waiting)
                  </p>
                  {display.waiting.length > 0 ? (
                    <div className="space-y-2">
                      {display.waiting.slice(0, 5).map((ticket) => (
                        <div
                          key={ticket.id}
                          className="flex items-center justify-between rounded border p-2 text-sm"
                        >
                          <span className="font-medium">{ticket.code}</span>
                          <span className="text-xs text-muted-foreground">
                            Service: {ticket.service}
                          </span>
                        </div>
                      ))}
                      {display.waiting.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          +{display.waiting.length - 5} more tickets...
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground">
                      Queue is empty
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Daily Report */}
      <DailyReportViewer />

      {/* Divider */}
      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold tracking-tight mb-6">Advanced Analytics</h2>
      </div>

      {/* Employee Performance Dashboard Section */}
      <EmployeePerformanceDashboard />

      {/* Service Category Analytics Section */}
      <ServiceCategoryAnalytics />

      {/* Employee Case Queue Section */}
      <EmployeeCaseQueue />

      {/* Case Workflow Tracker Section */}
      <CaseWorkflowTracker />
    </div>
  );
}

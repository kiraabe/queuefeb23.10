import { useState, useMemo } from "react";
import { useSSE } from "@/hooks/use-sse";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertCircle,
  Wifi,
  WifiOff,
  Activity,
  DownloadCloud,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import type { QueueSnapshot, WindowState, Ticket } from "@shared/api";
import DailyReportViewer from "./DailyReportViewer";

type TimeFilter = "all" | "today" | "month";

export default function WindowMonitoring() {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today");

  useSSE("/api/events", (event) => {
    if (event.type === "init") {
      const snapshot = event.payload as QueueSnapshot;
      setWindows(snapshot.windows);
      setTickets(snapshot.tickets);
    } else if (event.type === "window.updated") {
      setWindows((prev) =>
        prev.map((w) =>
          w.id === (event.payload as WindowState).id
            ? (event.payload as WindowState)
            : w,
        ),
      );
    } else if (event.type === "ticket.updated") {
      const ticket = event.payload as Ticket;
      setTickets((prev) => ({ ...prev, [ticket.id]: ticket }));
    }
  });

  const getTimeRange = () => {
    const now = new Date();
    switch (timeFilter) {
      case "today":
        return {
          start: startOfDay(now),
          end: endOfDay(now),
        };
      case "month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      case "all":
      default:
        return {
          start: new Date(0),
          end: new Date(),
        };
    }
  };

  const isTicketInRange = (ticket: Ticket) => {
    const { start, end } = getTimeRange();
    const ticketDate = new Date(ticket.createdAt);
    return ticketDate >= start && ticketDate <= end;
  };

  const windowStats = useMemo(() => {
    return windows.map((window) => {
      const currentTicket = window.currentTicketId
        ? tickets[window.currentTicketId]
        : null;

      const ticketList = Object.values(tickets);
      const filteredTickets = ticketList.filter(isTicketInRange);

      const servedByWindow = filteredTickets.filter(
        (t) => t.status === "done" && (t.windowId === window.id || t.transferredFromWindow === window.id),
      );
      const skippedByWindow = filteredTickets.filter(
        (t) => t.status === "skipped" && t.skippedByWindow === window.id,
      );
      const transferredFromWindow = filteredTickets.filter(
        (t) =>
          t.status === "transferred" && t.transferredFromWindow === window.id,
      );
      const transferredToWindow = filteredTickets.filter(
        (t) =>
          t.status === "transferred" && t.transferredToWindow === window.id,
      );

      const completedWithTiming = servedByWindow.filter(
        (t) => t.startedAt && t.completedAt,
      );
      const servingTimes = completedWithTiming.map(
        (t) => (t.completedAt! - t.startedAt!) / 1000,
      );
      const avgServiceTime =
        servingTimes.length > 0
          ? Math.round(
              servingTimes.reduce((a, b) => a + b, 0) / servingTimes.length,
            )
          : null;

      const waitingForWindow = ticketList.filter((t) => t.status === "waiting");

      const totalCasesHandled = servedByWindow.length + skippedByWindow.length;
      const completionRate =
        totalCasesHandled > 0
          ? Math.round((servedByWindow.length / totalCasesHandled) * 100)
          : 0;
      const skippedRate =
        totalCasesHandled > 0
          ? Math.round((skippedByWindow.length / totalCasesHandled) * 100)
          : 0;

      return {
        window,
        currentTicket,
        servedToday: servedByWindow.length,
        skippedToday: skippedByWindow.length,
        transferredFrom: transferredFromWindow.length,
        transferredTo: transferredToWindow.length,
        avgServiceTime,
        waitingInQueue: waitingForWindow.length,
        totalCasesHandled,
        completionRate,
        skippedRate,
        activeEmployees: window.tellerUsername ? 1 : 0,
      };
    });
  }, [windows, tickets, timeFilter]);

  const totalStats = useMemo(() => {
    const served = windowStats.reduce((sum, w) => sum + w.servedToday, 0);
    const busy = windowStats.filter((w) => w.window.busy).length;
    return { served, busy, total: windows.length };
  }, [windowStats]);

  const getLastUpdateDuration = (timestamp: number) => {
    const now = Date.now();
    const diff = (now - timestamp) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    return `${Math.round(diff / 3600)}h ago`;
  };

  const getTimeFilterLabel = () => {
    switch (timeFilter) {
      case "today":
        return "Today";
      case "month":
        return "This Month";
      case "all":
        return "All Time";
    }
  };

  const getServedLabel = () => {
    switch (timeFilter) {
      case "today":
        return "Served Today";
      case "month":
        return "Served This Month";
      case "all":
        return "Served (All Time)";
    }
  };

  const getCSVFileName = () => {
    const now = new Date();
    const dateStr = format(now, "yyyy-MM-dd");
    switch (timeFilter) {
      case "today":
        return `windows-report-today-${dateStr}.csv`;
      case "month":
        return `windows-report-month-${format(now, "yyyy-MM")}.csv`;
      case "all":
        return `windows-report-all-time-${dateStr}.csv`;
    }
  };

  const downloadWindowsCSV = () => {
    const headers = [
      "Window ID",
      "Window Name",
      "Teller",
      "Served",
      "Skipped",
      "Transferred From",
      "Transferred To",
      "Avg Service Time (seconds)",
      "Total Cases",
      "Completion Rate (%)",
    ];

    const rows = windowStats.map((stat) => [
      stat.window.id,
      stat.window.name,
      stat.window.tellerUsername || "N/A",
      stat.servedToday,
      stat.skippedToday,
      stat.transferredFrom,
      stat.transferredTo,
      stat.avgServiceTime || "N/A",
      stat.totalCasesHandled,
      stat.completionRate,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getCSVFileName();
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Time Filter */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Time Period</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Showing data for: {getTimeFilterLabel()}
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={timeFilter}
          onValueChange={(value) => {
            if (value) setTimeFilter(value as TimeFilter);
          }}
          className="border rounded-lg p-1"
        >
          <ToggleGroupItem value="all" aria-label="All time">
            All Time
          </ToggleGroupItem>
          <ToggleGroupItem value="today" aria-label="Today">
            Today
          </ToggleGroupItem>
          <ToggleGroupItem value="month" aria-label="This month">
            This Month
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Window Status Overview</CardTitle>
              <CardDescription>
                Real-time monitoring of all service windows
              </CardDescription>
            </div>
            <Button onClick={downloadWindowsCSV} variant="outline" size="sm">
              <DownloadCloud className="mr-2 h-4 w-4" />
              Download Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Active Windows</p>
              <p className="text-2xl font-bold">
                {totalStats.busy}/{totalStats.total}
              </p>
              <Progress
                value={(totalStats.busy / totalStats.total) * 100}
                className="mt-2"
              />
            </div>
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{getServedLabel()}</p>
              <p className="text-2xl font-bold">{totalStats.served}</p>
              <p className="text-xs text-muted-foreground">
                across all windows
              </p>
            </div>
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Queue Depth</p>
              <p className="text-2xl font-bold">
                {windowStats[0]?.waitingInQueue || 0}
              </p>
              <p className="text-xs text-muted-foreground">waiting customers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Window Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {windowStats.map(
          ({
            window,
            currentTicket,
            servedToday,
            skippedToday,
            totalCasesHandled,
            completionRate,
            skippedRate,
            avgServiceTime,
            activeEmployees,
          }) => (
            <Card key={window.id} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 pb-3 dark:from-gray-900 dark:to-gray-800">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{window.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {window.busy ? (
                        <Badge className="bg-green-100 text-green-800">
                          <Activity className="mr-1 h-3 w-3" />
                          Serving
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          <Wifi className="mr-1 h-3 w-3" />
                          Idle
                        </Badge>
                      )}
                    </div>
                  </div>
                  {window.tellerUsername && (
                    <div className="text-sm text-muted-foreground">
                      Teller:{" "}
                      <span className="font-medium">
                        {window.tellerUsername}
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* Current Ticket */}
                {currentTicket ? (
                  <div className="space-y-2 rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
                    <p className="text-xs text-muted-foreground">
                      Currently Serving
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {currentTicket.code}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Service: {currentTicket.service}
                      {currentTicket.ownerName &&
                        ` • Customer: ${currentTicket.ownerName}`}
                    </p>
                    {currentTicket.startedAt && (
                      <p className="text-xs text-muted-foreground">
                        Started:{" "}
                        {format(new Date(currentTicket.startedAt), "HH:mm:ss")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-lg border border-dashed p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      No customer currently being served
                    </p>
                  </div>
                )}

                {/* Statistics Grid */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="space-y-1 rounded border p-2">
                    <p className="text-xs text-muted-foreground">Served</p>
                    <p className="font-bold text-green-600">{servedToday}</p>
                  </div>
                  <div className="space-y-1 rounded border p-2">
                    <p className="text-xs text-muted-foreground">Skipped</p>
                    <p className="font-bold text-orange-600">{skippedToday}</p>
                  </div>
                  <div className="space-y-1 rounded border p-2">
                    <p className="text-xs text-muted-foreground">
                      Completion Rate
                    </p>
                    <p className="font-bold text-blue-600">{completionRate}%</p>
                  </div>
                  <div className="space-y-1 rounded border p-2">
                    <p className="text-xs text-muted-foreground">
                      Skipped Rate
                    </p>
                    <p className="font-bold text-red-600">{skippedRate}%</p>
                  </div>
                  <div className="space-y-1 rounded border p-2">
                    <p className="text-xs text-muted-foreground">Total Cases</p>
                    <p className="font-bold">{totalCasesHandled}</p>
                  </div>
                  <div className="space-y-1 rounded border p-2">
                    <p className="text-xs text-muted-foreground">Avg Service</p>
                    <p className="font-bold">
                      {avgServiceTime ? `${avgServiceTime}s` : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Last Update */}
                <div className="border-t pt-3 text-xs text-muted-foreground">
                  Last updated: {getLastUpdateDuration(window.updatedAt)}
                </div>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      {/* Daily Report */}
      <DailyReportViewer />
    </div>
  );
}

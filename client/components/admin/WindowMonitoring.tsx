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
import {
  AlertCircle,
  Wifi,
  WifiOff,
  Activity,
  DownloadCloud,
} from "lucide-react";
import { format } from "date-fns";
import type { QueueSnapshot, WindowState, Ticket } from "@shared/api";
import DailyReportViewer from "./DailyReportViewer";

export default function WindowMonitoring() {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});

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

  const windowStats = useMemo(() => {
    return windows.map((window) => {
      const currentTicket = window.currentTicketId
        ? tickets[window.currentTicketId]
        : null;

      const ticketList = Object.values(tickets);
      const todayTickets = ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        const today = new Date().toDateString();
        return ticketDate === today;
      });

      const servedByWindow = todayTickets.filter(
        (t) => t.status === "done" && (t.windowId === window.id || t.transferredFromWindow === window.id),
      );
      const skippedByWindow = todayTickets.filter(
        (t) => t.status === "skipped" && t.skippedByWindow === window.id,
      );
      const transferredFromWindow = todayTickets.filter(
        (t) =>
          t.status === "transferred" && t.transferredFromWindow === window.id,
      );
      const transferredToWindow = todayTickets.filter(
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
  }, [windows, tickets]);

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

  const downloadWindowsCSV = () => {
    const headers = [
      "Window ID",
      "Window Name",
      "Teller",
      "Served Today",
      "Skipped Today",
      "Transferred From",
      "Transferred To",
      "Avg Service Time (seconds)",
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
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `windows-daily-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
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
              Download Daily Report
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
              <p className="text-sm text-muted-foreground">Served Today</p>
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

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Window Status Overview Report</CardTitle>
          <CardDescription>
            Detailed window performance and service metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {windowStats.map(
              ({ window, currentTicket, servedToday, avgServiceTime }) => (
                <div
                  key={window.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h3 className="font-semibold text-base">{window.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Teller: {window.tellerUsername || "Not assigned"}
                      </p>
                    </div>
                    <Badge
                      variant={window.busy ? "default" : "outline"}
                      className={
                        window.busy
                          ? "bg-green-100 text-green-800"
                          : "text-muted-foreground"
                      }
                    >
                      {window.busy ? "Serving" : "Idle"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Current Ticket
                      </p>
                      <p className="text-lg font-bold">
                        {currentTicket ? currentTicket.code : "—"}
                      </p>
                      {currentTicket && (
                        <p className="text-xs text-muted-foreground">
                          Service: {currentTicket.service}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Tickets Served
                      </p>
                      <p className="text-lg font-bold">{servedToday}</p>
                      <p className="text-xs text-muted-foreground">today</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Avg Service Time
                      </p>
                      <p className="text-lg font-bold">
                        {avgServiceTime ? `${avgServiceTime}s` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        per ticket
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Status
                      </p>
                      <p className="text-lg font-bold">
                        {window.online ? "Online" : "Offline"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getLastUpdateDuration(window.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {/* Daily Report */}
      <DailyReportViewer />
    </div>
  );
}

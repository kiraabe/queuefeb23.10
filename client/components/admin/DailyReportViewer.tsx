import { useState, useEffect, useMemo } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Download,
  RefreshCw,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface DailyReport {
  reportDate: string;
  generatedAt: string;
  summary: {
    totalTicketsCreated: number;
    served: number;
    skipped: number;
    transferred: number;
    averageServiceTime: number | null;
  };
  windowStats: Array<{
    windowId: number;
    windowName: string;
    tellerName: string;
    servedTickets: number;
    averageServiceTime: number | null;
    performanceLevel: "on_time" | "slightly_over" | "significantly_over" | null;
  }>;
  detailedTickets: Array<{
    ticketId: string;
    ticketCode: string;
    service: string;
    windowId: number | null;
    windowName: string;
    ownerName?: string;
    woreda?: string;
    selectedServices?: string[];
    createdAt: number;
    startedAt: number;
    completedAt: number;
    serviceDurationSeconds: number | null;
    standardTimeMinutes: number | null;
    performanceLevel: "on_time" | "slightly_over" | "significantly_over" | null;
  }>;
  serviceStandardTimes: Record<string, number>;
}

const formatSeconds = (seconds: number | null) => {
  if (seconds === null || seconds === 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}hr ${minutes}min ${secs}sec`;
  } else if (minutes > 0) {
    return `${minutes}min ${secs}sec`;
  } else {
    return `${secs}sec`;
  }
};

const getPerformanceColor = (level: string | null) => {
  switch (level) {
    case "on_time":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "slightly_over":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "significantly_over":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  }
};

const getPerformanceBarColor = (level: string | null) => {
  switch (level) {
    case "on_time":
      return "bg-green-600";
    case "slightly_over":
      return "bg-yellow-600";
    case "significantly_over":
      return "bg-red-600";
    default:
      return "bg-gray-600";
  }
};

interface EmployeeStats {
  totalEmployees: number;
  totalCases: number;
  topPerformer: string;
  avgDuration: number | null;
}

export default function DailyReportViewer() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(null);

  // Date range state
  const [fromDate, setFromDate] = useState<Date | null>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default to last 30 days
    return d;
  });
  const [toDate, setToDate] = useState<Date | null>(new Date());

  // Filter state
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [expandedWindows, setExpandedWindows] = useState<Set<number>>(new Set());

  const fetchReport = async (from?: Date | null, to?: Date | null) => {
    try {
      setLoading(true);
      setError(null);

      if (!from || !to) {
        setError("Please select both From and To dates");
        setLoading(false);
        return;
      }

      const fromUTC = new Date(
        Date.UTC(
          from.getFullYear(),
          from.getMonth(),
          from.getDate(),
          0,
          0,
          0,
          0,
        ),
      );

      const toUTC = new Date(
        Date.UTC(
          to.getFullYear(),
          to.getMonth(),
          to.getDate(),
          23,
          59,
          59,
          999,
        ),
      );

      const fromISO = fromUTC.toISOString();
      const toISO = toUTC.toISOString();

      const data = await apiFetch<DailyReport>(
        `/api/admin/daily-report?fromDate=${fromISO}&toDate=${toISO}&_t=${Date.now()}`,
      );

      console.log("[DailyReportViewer] Report data received:", {
        windowStatsCount: data.windowStats?.length || 0,
        detailedTicketsCount: data.detailedTickets?.length || 0,
        summary: data.summary,
        reportDate: data.reportDate,
      });
      setReport(data);
    } catch (err) {
      let errorMsg = "Unknown error occurred";
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMsg =
            "Request timed out. The report query is taking too long. Please try a shorter date range or try again later.";
        } else {
          errorMsg = err.message;
        }
      }
      console.error("[DailyReportViewer] Error fetching report:", errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(fromDate, toDate);

    // Also fetch employee stats
    const fetchEmployeeStats = async () => {
      try {
        const data = await apiFetch<EmployeeStats>("/api/admin/employee-stats");
        setEmployeeStats(data);
      } catch (err) {
        console.debug("[DailyReportViewer] Error fetching employee stats");
      }
    };

    fetchEmployeeStats();
  }, [fromDate, toDate]);

  // Get unique services from detailedTickets
  const services = useMemo(() => {
    if (!report) return [];
    return Array.from(new Set(report.detailedTickets.map((t) => t.service))).sort();
  }, [report]);

  // Get unique windows from windowStats
  const windows = useMemo(() => {
    if (!report) return [];
    return report.windowStats.map((w) => w.windowId).sort((a, b) => a - b);
  }, [report]);

  // Filter detailed tickets based on selected service and window
  const filteredTickets = useMemo(() => {
    if (!report) return [];
    return report.detailedTickets.filter((ticket) => {
      const serviceMatch =
        !selectedService || ticket.service === selectedService;
      const windowMatch =
        selectedWindow === null || ticket.windowId === selectedWindow;
      return serviceMatch && windowMatch;
    });
  }, [report, selectedService, selectedWindow]);

  const downloadCSV = () => {
    if (!report) return;

    const lines: string[] = [];

    // Report Header
    lines.push("DAILY QUEUE REPORT");
    lines.push(`Report Date Range: ${report.reportDate}`);
    lines.push(`Generated: ${format(new Date(report.generatedAt), "PPpp")}`);
    lines.push("");

    // Summary Section
    lines.push("SUMMARY");
    lines.push(
      "Metric,Value",
    );
    lines.push(`Total Tickets Created,${report.summary.totalTicketsCreated}`);
    lines.push(`Total Served,${report.summary.served}`);
    lines.push(`Total Skipped,${report.summary.skipped}`);
    lines.push(`Total Transferred,${report.summary.transferred}`);
    lines.push(
      `Average Service Time (seconds),${report.summary.averageServiceTime ?? "N/A"}`,
    );
    lines.push("");

    // Window Statistics Section
    lines.push("WINDOW STATISTICS");
    lines.push(
      "Window ID,Window Name,Teller,Served Tickets,Avg Service Time (seconds),Performance"
    );
    report.windowStats.forEach((window) => {
      const performance = window.performanceLevel || "N/A";
      lines.push(
        `${window.windowId},"${window.windowName}","${window.tellerName}",${window.servedTickets},${window.averageServiceTime ?? "N/A"},"${performance}"`
      );
    });
    lines.push("");

    // Detailed Ticket Table
    lines.push("DETAILED TICKET TABLE");
    lines.push(
      "Ticket Code,Service,Ticketer Full Name,Wereda,Selected Services,Window ID,Window Name,Created At,Service Start,Service End,Duration (seconds),Standard Time (minutes),Performance"
    );
    filteredTickets.forEach((ticket) => {
      const createdDate = format(new Date(ticket.createdAt), "yyyy-MM-dd HH:mm:ss");
      const startDate = format(new Date(ticket.startedAt), "yyyy-MM-dd HH:mm:ss");
      const endDate = format(new Date(ticket.completedAt), "yyyy-MM-dd HH:mm:ss");
      const performance = ticket.performanceLevel === "on_time" ? "On Time" :
                         ticket.performanceLevel === "slightly_over" ? "Slightly Over" :
                         ticket.performanceLevel === "significantly_over" ? "Significantly Over" : "N/A";
      const standardTime = ticket.standardTimeMinutes ? `${ticket.standardTimeMinutes}` : "N/A";
      const selectedServices = Array.isArray(ticket.selectedServices)
        ? ticket.selectedServices.join("; ")
        : ticket.selectedServices || "";
      const windowName = ticket.windowName || `Window ${ticket.windowId || "N/A"}`;

      lines.push(
        `"${ticket.ticketCode}","${ticket.service}","${ticket.ownerName || ""}","${ticket.woreda || ""}","${selectedServices}",${ticket.windowId || "N/A"},"${windowName}","${createdDate}","${startDate}","${endDate}",${ticket.serviceDurationSeconds ?? "N/A"},"${standardTime}","${performance}"`
      );
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${report.reportDate.replace(/ /g, "_")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleWindowExpanded = (windowId: number) => {
    const newSet = new Set(expandedWindows);
    if (newSet.has(windowId)) {
      newSet.delete(windowId);
    } else {
      newSet.add(windowId);
    }
    setExpandedWindows(newSet);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading report...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="pt-6">
          <Alert variant="default" className="border-red-500 bg-red-50 dark:bg-red-950/30">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Header and Controls */}
      <Card className="border-2 border-blue-200 dark:border-blue-900">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-t-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                Daily Queue Report
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300 mt-2">
                {report ? (
                  <>
                    <span className="font-semibold">Report Period: </span>
                    {report.reportDate}
                    <br />
                    <span className="text-xs">
                      Generated: {format(new Date(report.generatedAt), "PPpp")}
                    </span>
                  </>
                ) : (
                  "No data available"
                )}
              </CardDescription>
            </div>
            <Button
              onClick={downloadCSV}
              disabled={!report}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Date Range Picker */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                <CalendarIcon className="h-4 w-4 inline mr-2" />
                From Date
              </label>
              <ReactDatePicker
                selected={fromDate}
                onChange={(date) => setFromDate(date)}
                dateFormat="yyyy-MM-dd"
                className="rounded-md border border-input px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                <CalendarIcon className="h-4 w-4 inline mr-2" />
                To Date
              </label>
              <ReactDatePicker
                selected={toDate}
                onChange={(date) => setToDate(date)}
                dateFormat="yyyy-MM-dd"
                className="rounded-md border border-input px-3 py-2"
              />
            </div>
            <Button
              onClick={() => fetchReport(fromDate, toDate)}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Filter Options */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Filter by Service
              </label>
              <select
                value={selectedService || ""}
                onChange={(e) => setSelectedService(e.target.value || null)}
                className="w-full rounded-md border border-input px-3 py-2"
              >
                <option value="">All Services</option>
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Filter by Window
              </label>
              <select
                value={selectedWindow !== null ? selectedWindow : ""}
                onChange={(e) =>
                  setSelectedWindow(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-md border border-input px-3 py-2"
              >
                <option value="">All Windows</option>
                {windows.map((window) => (
                  <option key={window} value={window}>
                    Window {window}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Section */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-xl">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="rounded-lg border p-4 bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Total Created
              </p>
              <p className="text-2xl font-bold text-foreground mt-2">
                {report?.summary.totalTicketsCreated ?? 0}
              </p>
            </div>
            <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase">
                Served
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                {report?.summary.served ?? 0}
              </p>
            </div>
            <div className="rounded-lg border p-4 bg-yellow-50 dark:bg-yellow-950/20">
              <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 uppercase">
                Skipped
              </p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                {report?.summary.skipped ?? 0}
              </p>
            </div>
            <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">
                Transferred
              </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                {report?.summary.transferred ?? 0}
              </p>
            </div>
            <div className="rounded-lg border p-4 bg-purple-50 dark:bg-purple-950/20">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">
                Avg Service Time
              </p>
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-2">
                {formatSeconds(report?.summary.averageServiceTime ?? null)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Statistics Section */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-xl">Employee Statistics</CardTitle>
          <CardDescription>Staff performance and workload summary</CardDescription>
        </CardHeader>
        <CardContent>
          {employeeStats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg border p-4 bg-card">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Total Employees
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {employeeStats.totalEmployees}
                </p>
              </div>
              <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">
                  Total Cases
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                  {employeeStats.totalCases}
                </p>
              </div>
              <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20">
                <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase">
                  Top Performer
                </p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-2 truncate">
                  {employeeStats.topPerformer}
                </p>
              </div>
              <div className="rounded-lg border p-4 bg-purple-50 dark:bg-purple-950/20">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">
                  Avg Duration
                </p>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-2">
                  {formatSeconds(employeeStats.avgDuration)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No employee data available
            </p>
          )}
        </CardContent>
      </Card>

      {/* Window Statistics Section */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-xl">Window Performance Statistics</CardTitle>
          <CardDescription>Based on served tickets only</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {report?.windowStats && report.windowStats.length > 0 ? (
              report.windowStats.map((window) => (
                <div
                  key={window.windowId}
                  className="rounded-lg border p-4 bg-card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">
                          {window.windowName}
                        </h3>
                        <span className="text-sm text-muted-foreground">
                          (ID: {window.windowId})
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Teller: <span className="font-medium">{window.tellerName}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => toggleWindowExpanded(window.windowId)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      {expandedWindows.has(window.windowId) ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Served Tickets
                      </p>
                      <p className="text-xl font-bold mt-1">
                        {window.servedTickets}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Avg Service Time
                      </p>
                      <p className="text-lg font-bold mt-1">
                        {formatSeconds(window.averageServiceTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Performance
                      </p>
                      <p className={cn("text-sm font-bold mt-1 px-2 py-1 rounded-md w-fit", getPerformanceColor(window.performanceLevel))}>
                        {window.performanceLevel === "on_time"
                          ? "✓ On Time"
                          : window.performanceLevel === "slightly_over"
                            ? "⚠ Slightly Over"
                            : window.performanceLevel === "significantly_over"
                              ? "✕ Over"
                              : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No window data available
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Ticket Table */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-xl">
            Detailed Tickets ({filteredTickets.length})
          </CardTitle>
          <CardDescription>
            Ticket details with service performance and customer information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[80px]">Ticket #</TableHead>
                  <TableHead className="min-w-[100px]">Service</TableHead>
                  <TableHead className="min-w-[120px]">Ticketer Name</TableHead>
                  <TableHead className="min-w-[100px]">Wereda</TableHead>
                  <TableHead className="min-w-[120px]">Selected Services</TableHead>
                  <TableHead className="min-w-[60px]">Window</TableHead>
                  <TableHead className="min-w-[130px]">Service Start</TableHead>
                  <TableHead className="min-w-[130px]">Service End</TableHead>
                  <TableHead className="text-right min-w-[80px]">Duration</TableHead>
                  <TableHead className="text-right min-w-[90px]">Standard</TableHead>
                  <TableHead className="min-w-[90px]">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.length > 0 ? (
                  filteredTickets.map((ticket) => (
                    <TableRow key={ticket.ticketId}>
                      <TableCell className="font-semibold">
                        {ticket.ticketCode}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ticket.service}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ticket.ownerName || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ticket.woreda || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {Array.isArray(ticket.selectedServices) && ticket.selectedServices.length > 0 ? (
                          <div className="space-y-1">
                            {ticket.selectedServices.map((service, idx) => (
                              <div key={idx} className="text-xs">• {service}</div>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        W{ticket.windowId || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(
                          new Date(ticket.startedAt),
                          "MM-dd HH:mm"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(
                          new Date(ticket.completedAt),
                          "MM-dd HH:mm"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatSeconds(ticket.serviceDurationSeconds)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {ticket.standardTimeMinutes
                          ? `${ticket.standardTimeMinutes} min`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-block px-2 py-1 rounded text-xs font-semibold whitespace-nowrap",
                            getPerformanceColor(ticket.performanceLevel)
                          )}
                        >
                          {ticket.performanceLevel === "on_time"
                            ? "✓ On Time"
                            : ticket.performanceLevel === "slightly_over"
                              ? "⚠ Slightly Over"
                              : ticket.performanceLevel === "significantly_over"
                                ? "✕ Over"
                                : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No tickets found for the selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

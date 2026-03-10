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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
import { formatCSVCell, downloadCSVFile } from "@/lib/csv";

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
    performanceLevel: "on_time" | "slightly_over" | "moderately_over" | "significantly_over" | null;
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
    performanceLevel: "on_time" | "slightly_over" | "moderately_over" | "significantly_over" | null;
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
    case "moderately_over":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
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
    case "moderately_over":
      return "bg-orange-600";
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
        windowStatsData: data.windowStats ? data.windowStats.slice(0, 3) : 'NO DATA',
      });
      console.log("[DailyReportViewer] Full data object:", data);
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

    // Helper to format a row
    const row = (...cells: any[]) => cells.map(formatCSVCell).join(",");

    // Report Header
    lines.push(row("DAILY QUEUE REPORT"));
    lines.push(row(`Report Date Range: ${report.reportDate}`));
    lines.push(row(`Generated: ${format(new Date(report.generatedAt), "PPpp")}`));
    lines.push("");

    // Summary Section
    lines.push(row("SUMMARY"));
    lines.push(row("Metric", "Value"));
    lines.push(row("Total Tickets Created", report.summary.totalTicketsCreated));
    lines.push(row("Total Served", report.summary.served));
    lines.push(row("Total Skipped", report.summary.skipped));
    lines.push(row("Total Transferred", report.summary.transferred));
    lines.push(
      row("Average Service Time (seconds)", report.summary.averageServiceTime ?? "N/A"),
    );
    lines.push("");

    // Window Statistics Section - use ALL windows from report
    if (report.windowStats && report.windowStats.length > 0) {
      lines.push(row("WINDOW STATISTICS"));
      lines.push(
        row("Window Name", "Teller", "Served Tickets", "Avg Service Time (seconds)", "Performance")
      );
      report.windowStats.forEach((window) => {
        const windowId = window.windowId !== null && window.windowId !== undefined ? window.windowId : "N/A";
        const windowName = (window.windowName && window.windowName !== "null")
          ? window.windowName
          : (windowId !== "N/A" ? `Window ${windowId}` : "N/A");
        const performance = window.performanceLevel ?
          (window.performanceLevel === "on_time" ? "On Time" :
           window.performanceLevel === "slightly_over" ? "Slightly Over" :
           window.performanceLevel === "moderately_over" ? "Moderately Over" :
           window.performanceLevel === "significantly_over" ? "Significantly Over" : "N/A") : "N/A";
        const avgTime = window.averageServiceTime !== null && window.averageServiceTime !== undefined ? window.averageServiceTime : "N/A";
        const servedCount = window.servedTickets !== null && window.servedTickets !== undefined ? window.servedTickets : 0;

        lines.push(
          row(windowName, window.tellerName, servedCount, avgTime, performance)
        );
      });
      lines.push("");
    }

    // Detailed Ticket Table - use ALL tickets (not filtered for CSV export)
    if (report.detailedTickets && report.detailedTickets.length > 0) {
      lines.push(row("DETAILED TICKET TABLE"));
      lines.push(
        row("Ticket Code", "Service", "Ticketer Full Name", "Wereda", "Selected Services", "Window Name", "Created At", "Service Start", "Service End", "Duration (seconds)", "Standard Time (minutes)", "Performance")
      );
      report.detailedTickets.forEach((ticket) => {
        const formatCSVDate = (ts: number | null | undefined) => {
          if (!ts || ts === 0) return "N/A";
          try {
            return format(new Date(ts), "yyyy-MM-dd HH:mm:ss");
          } catch (e) {
            return "N/A";
          }
        };

        const createdDate = formatCSVDate(ticket.createdAt);
        const startDate = formatCSVDate(ticket.startedAt);
        const endDate = formatCSVDate(ticket.completedAt);
        const performance = ticket.performanceLevel === "on_time" ? "On Time" :
                           ticket.performanceLevel === "slightly_over" ? "Slightly Over" :
                           ticket.performanceLevel === "moderately_over" ? "Moderately Over" :
                           ticket.performanceLevel === "significantly_over" ? "Significantly Over" : "N/A";
        const standardTime = ticket.standardTimeMinutes ? `${ticket.standardTimeMinutes}` : "N/A";
        const selectedServices = Array.isArray(ticket.selectedServices)
          ? ticket.selectedServices.join("; ")
          : ticket.selectedServices || "";

        const windowId = ticket.windowId !== null && ticket.windowId !== undefined ? ticket.windowId : "N/A";
        const windowName = (ticket.windowName && ticket.windowName !== "null")
          ? ticket.windowName
          : (windowId !== "N/A" ? `Window ${windowId}` : "N/A");

        lines.push(
          row(
            ticket.ticketCode,
            ticket.service,
            ticket.ownerName || "",
            ticket.woreda || "",
            selectedServices,
            windowName,
            createdDate,
            startDate,
            endDate,
            ticket.serviceDurationSeconds ?? "N/A",
            standardTime,
            performance
          )
        );
      });
    }

    const csv = lines.join("\n");
    const filename = `report-${report.reportDate.replace(/ /g, "_")}.csv`;
    downloadCSVFile(csv, filename);
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
                  <TableHead className="min-w-[100px]">Window Name</TableHead>
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
                      <TableCell className="text-sm font-medium">
                        {(ticket.windowName && ticket.windowName !== "null")
                          ? ticket.windowName
                          : (ticket.windowId !== null && ticket.windowId !== undefined ? `Window ${ticket.windowId}` : "—")}
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "inline-block px-2 py-1 rounded text-xs font-semibold whitespace-nowrap cursor-help",
                                getPerformanceColor(ticket.performanceLevel)
                              )}
                            >
                              {ticket.performanceLevel === "on_time"
                                ? "✓ On Time"
                                : ticket.performanceLevel === "slightly_over"
                                  ? "⚠ Slightly Over"
                                  : ticket.performanceLevel === "moderately_over"
                                    ? "⚠ Moderately Over"
                                    : ticket.performanceLevel === "significantly_over"
                                      ? "✕ Over"
                                      : "—"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {ticket.performanceLevel === "on_time" && "🟢 On Time - Good performance (≥ 65%)"}
                            {ticket.performanceLevel === "slightly_over" && "🟡 Slightly Over - Minor delay (50-64%)"}
                            {ticket.performanceLevel === "moderately_over" && "🟠 Moderately Over - Significant delay (30-49%)"}
                            {ticket.performanceLevel === "significantly_over" && "🔴 Significantly Over - Major delay (< 30%)"}
                          </TooltipContent>
                        </Tooltip>
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

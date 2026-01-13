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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Download,
  RefreshCw,
  TrendingUp,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, subYears, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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
  allTickets: Array<{
    ticketId: string;
    ticketCode: string;
    service: string;
    status: string;
    windowId: number | null;
    windowName: string | null;
    createdAt: number;
    completedAt: number | null;
    category?: string;
  }>;
  skipped: Array<{
    ticketId: string;
    ticketCode: string;
    service: string;
    ticketNumber: number;
    createdAt: number;
    skippedAt: number;
    skippedByWindow: number | null;
    skippedByWindowName: string | null;
    remark: string | null;
  }>;
  transfers: Array<{
    transferId: string;
    ticketId: string;
    ticketCode: string;
    service: string;
    ticketNumber: number;
    createdAt: number;
    transferredAt: number;
    fromWindow: number;
    fromWindowName: string | null;
    toWindow: number;
    toWindowName: string | null;
    remark: string | null;
  }>;
  windowStats: Array<{
    windowId: number;
    windowName: string;
    tellerName: string;
    served: number;
    skipped: number;
    transfersFrom: number;
    transfersTo: number;
    averageServiceTime: number | null;
  }>;
  employeePerformance: Array<{
    employeeId: string;
    employeeName: string;
    totalCasesStarted: number;
    casesCompleted: number;
    casesProceed: number;
    averageCaseTime: number | null;
    totalTimeSpent: number | null;
  }>;
  caseWorkflow: Array<{
    caseId: string;
    employeeId: string;
    employeeName: string;
    ticketId: string;
    ticketCode: string;
    service: string;
    jobTitle: string;
    startedAt: number | null;
    endedAt: number | null;
    status: string;
    durationSeconds: number | null;
  }>;
  categoryPerformance: Array<{
    categoryName: string;
    totalTickets: number;
    served: number;
    skipped: number;
    transferred: number;
    averageServiceTime: number | null;
  }>;
}

export default function DailyReportViewer() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range state
  const [fromDate, setFromDate] = useState<Date | null>(new Date());
  const [toDate, setToDate] = useState<Date | null>(new Date());

  const fetchReport = async (from?: Date | null, to?: Date | null) => {
    try {
      setLoading(true);
      setError(null);

      // Ensure dates are valid
      if (!from || !to) {
        setError("Please select both From and To dates");
        setLoading(false);
        return;
      }

      // Create date range in UTC to avoid timezone issues
      const fromStart = new Date(from);
      fromStart.setHours(0, 0, 0, 0);

      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);

      // Convert to ISO string and remove the Z to work with local timezone
      const fromISO = fromStart.toISOString();
      const toISO = toEnd.toISOString();

      console.log("Fetching report for date range:", {
        from: fromISO,
        to: toISO,
      });

      // Use URLSearchParams for proper parameter encoding
      const params = new URLSearchParams({
        fromDate: fromISO,
        toDate: toISO,
      });

      const url = `/api/admin/daily-report?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to fetch daily report: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("Report data received:", data);
      setReport(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("Error fetching report:", errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(fromDate, toDate);
  }, [fromDate, toDate]);

  const downloadCSV = () => {
    if (!report) return;

    const lines: string[] = [];

    lines.push("DAILY QUEUE REPORT");
    lines.push(`Report Date: ${report.reportDate}`);
    lines.push(`Generated: ${format(new Date(report.generatedAt), "PPpp")}`);
    lines.push("");

    lines.push("SUMMARY");
    lines.push(
      "Total Tickets Created,Served,Skipped,Transferred,Avg Service Time (sec)",
    );
    lines.push(
      `${report.summary.totalTicketsCreated},${report.summary.served},${report.summary.skipped},${report.summary.transferred},${report.summary.averageServiceTime ?? "-"}`,
    );
    lines.push("");

    lines.push("SUMMARY LISTS");
    lines.push("");

    lines.push("REGISTERED TICKETS");
    lines.push(`Total: ${report.summary.totalTicketsCreated}`);
    lines.push("Breakdown:");
    lines.push(`  Served: ${report.summary.served}`);
    lines.push(`  Skipped: ${report.summary.skipped}`);
    lines.push(`  Transferred: ${report.summary.transferred}`);
    lines.push("");

    lines.push("SERVED TICKETS SUMMARY");
    lines.push(`Total Served: ${report.summary.served}`);
    lines.push(
      "Avg Service Time: " +
        (report.summary.averageServiceTime
          ? `${report.summary.averageServiceTime}s`
          : "N/A"),
    );
    lines.push("");

    lines.push("SKIPPED TICKETS SUMMARY");
    lines.push(`Total Skipped: ${report.summary.skipped}`);
    lines.push("");

    lines.push("TRANSFERRED TICKETS SUMMARY");
    lines.push(`Total Transferred: ${report.summary.transferred}`);
    lines.push("");

    lines.push("ALL TICKETS CREATED TODAY");
    lines.push("Ticket Code,Service,Status,Window,Created At,Completed At");
    report.allTickets.forEach((t) => {
      const createdDate = format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss");
      const completedDate = t.completedAt
        ? format(new Date(t.completedAt), "yyyy-MM-dd HH:mm:ss")
        : "";
      const windowName =
        t.windowName || (t.windowId ? `Window ${t.windowId}` : "");
      lines.push(
        `${t.ticketCode},${t.service},${t.status},${windowName},${createdDate},${completedDate}`,
      );
    });
    lines.push("");

    const servedTickets = report.allTickets.filter((t) => t.status === "done");
    lines.push("SERVED TICKETS LIST");
    lines.push("Ticket Code,Service,Status,Window,Created At,Completed At");
    servedTickets.forEach((t) => {
      const createdDate = format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss");
      const completedDate = t.completedAt
        ? format(new Date(t.completedAt), "yyyy-MM-dd HH:mm:ss")
        : "";
      const windowName =
        t.windowName || (t.windowId ? `Window ${t.windowId}` : "");
      lines.push(
        `${t.ticketCode},${t.service},${t.status},${windowName},${createdDate},${completedDate}`,
      );
    });
    lines.push("");

    const skippedTickets = report.allTickets.filter(
      (t) => t.status === "skipped",
    );
    lines.push("SKIPPED TICKETS LIST");
    lines.push("Ticket Code,Service,Status,Window,Created At,Completed At");
    skippedTickets.forEach((t) => {
      const createdDate = format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss");
      const completedDate = t.completedAt
        ? format(new Date(t.completedAt), "yyyy-MM-dd HH:mm:ss")
        : "";
      const windowName =
        t.windowName || (t.windowId ? `Window ${t.windowId}` : "");
      lines.push(
        `${t.ticketCode},${t.service},${t.status},${windowName},${createdDate},${completedDate}`,
      );
    });
    lines.push("");

    const transferredTickets = report.allTickets.filter(
      (t) => t.status === "transferred",
    );
    lines.push("TRANSFERRED TICKETS LIST");
    lines.push("Ticket Code,Service,Status,Window,Created At,Completed At");
    transferredTickets.forEach((t) => {
      const createdDate = format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss");
      const completedDate = t.completedAt
        ? format(new Date(t.completedAt), "yyyy-MM-dd HH:mm:ss")
        : "";
      const windowName =
        t.windowName || (t.windowId ? `Window ${t.windowId}` : "");
      lines.push(
        `${t.ticketCode},${t.service},${t.status},${windowName},${createdDate},${completedDate}`,
      );
    });
    lines.push("");

    const waitingTickets = report.allTickets.filter(
      (t) => t.status === "waiting",
    );
    lines.push("WAITING TICKETS LIST");
    lines.push("Ticket Code,Service,Status,Window,Created At,Completed At");
    waitingTickets.forEach((t) => {
      const createdDate = format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss");
      const completedDate = t.completedAt
        ? format(new Date(t.completedAt), "yyyy-MM-dd HH:mm:ss")
        : "";
      const windowName =
        t.windowName || (t.windowId ? `Window ${t.windowId}` : "");
      lines.push(
        `${t.ticketCode},${t.service},${t.status},${windowName},${createdDate},${completedDate}`,
      );
    });
    lines.push("");

    lines.push("WINDOW STATISTICS");
    lines.push(
      '"Window ID","Window Name","Teller","Served Today","Skipped Today","Transferred From","Transferred To","Avg Service Time (seconds)"',
    );
    report.windowStats.forEach((w) => {
      lines.push(
        `"${w.windowId}","${w.windowName}","${w.tellerName}","${w.served}","${w.skipped}","${w.transfersFrom}","${w.transfersTo}","${w.averageServiceTime ?? "N/A"}"`,
      );
    });
    lines.push("");

    lines.push("DETAILED SKIPPED TICKETS");
    lines.push(
      "Ticket Code,Service,Number,Created At,Skipped At,Skipped By Window,Remark",
    );
    report.skipped.forEach((s) => {
      const createdDate = format(new Date(s.createdAt), "yyyy-MM-dd HH:mm:ss");
      const skippedDate = format(new Date(s.skippedAt), "yyyy-MM-dd HH:mm:ss");
      const remark = (s.remark || "").replace(/"/g, '""');
      lines.push(
        `${s.ticketCode},${s.service},${s.ticketNumber},${createdDate},${skippedDate},${s.skippedByWindowName || `Window ${s.skippedByWindow}`},"${remark}"`,
      );
    });
    lines.push("");

    lines.push("DETAILED TRANSFERRED TICKETS");
    lines.push(
      "Ticket Code,Service,Number,Created At,Transferred At,From Window,To Window,Remark",
    );
    report.transfers.forEach((t) => {
      const createdDate = format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss");
      const transferDate = format(
        new Date(t.transferredAt),
        "yyyy-MM-dd HH:mm:ss",
      );
      const remark = (t.remark || "").replace(/"/g, '""');
      lines.push(
        `${t.ticketCode},${t.service},${t.ticketNumber},${createdDate},${transferDate},${t.fromWindowName || `Window ${t.fromWindow}`},${t.toWindowName || `Window ${t.toWindow}`},"${remark}"`,
      );
    });
    lines.push("");

    lines.push("ADVANCED ANALYTICS");
    lines.push("Metric,Value");
    lines.push(`Total Tickets Created,${report.summary.totalTicketsCreated}`);
    lines.push(`Total Served,${report.summary.served}`);
    lines.push(`Total Skipped,${report.summary.skipped}`);
    lines.push(`Total Transferred,${report.summary.transferred}`);
    lines.push(
      `Average Service Time (seconds),${report.summary.averageServiceTime ?? "N/A"}`,
    );
    const completionRate =
      report.summary.totalTicketsCreated > 0
        ? Math.round(
            (report.summary.served / report.summary.totalTicketsCreated) * 100,
          )
        : 0;
    lines.push(`Completion Rate (%),${completionRate}`);
    const skipRate =
      report.summary.totalTicketsCreated > 0
        ? Math.round(
            (report.summary.skipped /
              Math.max(report.summary.totalTicketsCreated, 1)) *
              100,
          )
        : 0;
    lines.push(`Skip Rate (%),${skipRate}`);
    lines.push("");

    lines.push("EMPLOYEE PERFORMANCE DETAILS");
    lines.push(
      "Employee Name,Total Cases Started,Cases Completed,Cases Proceeded,Average Case Time (seconds),Total Time Spent (seconds)",
    );
    report.employeePerformance.forEach((e) => {
      lines.push(
        `${e.employeeName},${e.totalCasesStarted},${e.casesCompleted},${e.casesProceed},${e.averageCaseTime ?? "N/A"},${e.totalTimeSpent ?? "N/A"}`,
      );
    });
    lines.push("");

    lines.push("CATEGORY PERFORMANCE DETAILS");
    lines.push(
      "Category Name,Total Tickets,Served,Skipped,Transferred,Average Service Time (seconds)",
    );
    report.categoryPerformance.forEach((c) => {
      lines.push(
        `${c.categoryName},${c.totalTickets},${c.served},${c.skipped},${c.transferred},${c.averageServiceTime ?? "N/A"}`,
      );
    });
    lines.push("");

    lines.push("CASE WORKFLOW");
    lines.push(
      "Employee Name,Job Title,Ticket Code,Service,Status,Started At,Ended At,Duration (seconds)",
    );
    report.caseWorkflow.forEach((c) => {
      const startedDate = c.startedAt
        ? format(new Date(c.startedAt), "yyyy-MM-dd HH:mm:ss")
        : "N/A";
      const endedDate = c.endedAt
        ? format(new Date(c.endedAt), "yyyy-MM-dd HH:mm:ss")
        : "N/A";
      lines.push(
        `${c.employeeName},${c.jobTitle},${c.ticketCode},${c.service},${c.status},${startedDate},${endedDate},${c.durationSeconds ?? "N/A"}`,
      );
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Use the reportDate which now includes the date range
    const filename = `report-${report.reportDate.replace(/ /g, "_")}.csv`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Queue Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading report...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Queue Report</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Queue Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No report data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-2">
        {/* Date Range Picker */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              From Date
            </label>
            <div className="relative">
              <ReactDatePicker
                selected={fromDate}
                onChange={(date) => {
                  setFromDate(date);
                  // Auto-adjust toDate if it's before the new fromDate
                  if (date && toDate && date > toDate) {
                    setToDate(date);
                  }
                }}
                minDate={subYears(new Date(), 1)}
                maxDate={new Date()}
                dateFormat="MMM dd, yyyy"
                placeholderText="Pick a date"
                className="w-full md:w-auto px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                wrapperClassName="w-full md:w-auto"
                popperClassName="react-datepicker-popper"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Up to 1 year prior from today
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              To Date
            </label>
            <div className="relative">
              <ReactDatePicker
                selected={toDate}
                onChange={(date) => setToDate(date)}
                minDate={fromDate || subYears(new Date(), 1)}
                maxDate={new Date()}
                dateFormat="MMM dd, yyyy"
                placeholderText="Pick a date"
                className="w-full md:w-auto px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                wrapperClassName="w-full md:w-auto"
                popperClassName="react-datepicker-popper"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Up to today's date
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => fetchReport(fromDate, toDate)}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={downloadCSV} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue Report</CardTitle>
          <CardDescription>
            {report.reportDate.includes(" to ")
              ? `Period: ${report.reportDate}`
              : format(new Date(report.reportDate), "EEEE, MMMM d, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="windows">Windows</TabsTrigger>
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="skipped">Skipped</TabsTrigger>
              <TabsTrigger value="transfers">Transfers</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tickets</p>
                  <p className="text-2xl font-bold">
                    {report.summary.totalTicketsCreated}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Served</p>
                  <p className="text-2xl font-bold text-green-600">
                    {report.summary.served}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {report.summary.skipped}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transferred</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {report.summary.transferred}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Service</p>
                  <p className="text-2xl font-bold">
                    {report.summary.averageServiceTime
                      ? `${report.summary.averageServiceTime}s`
                      : "—"}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="windows">
              {report.windowStats.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  No window data available for the selected period
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Window</TableHead>
                      <TableHead>Teller</TableHead>
                      <TableHead>Served</TableHead>
                      <TableHead>Skipped</TableHead>
                      <TableHead>Transfers Out</TableHead>
                      <TableHead>Transfers In</TableHead>
                      <TableHead>Avg Service Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.windowStats.map((window) => (
                      <TableRow key={window.windowId}>
                        <TableCell className="font-medium">
                          {window.windowName}
                        </TableCell>
                        <TableCell>{window.tellerName}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {window.served}
                        </TableCell>
                        <TableCell className="font-semibold text-orange-600">
                          {window.skipped}
                        </TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          {window.transfersFrom}
                        </TableCell>
                        <TableCell className="font-semibold text-purple-600">
                          {window.transfersTo}
                        </TableCell>
                        <TableCell>
                          {window.averageServiceTime
                            ? `${window.averageServiceTime}s`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="employees">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Employee performance metrics based on case workflow data
                </p>
                {report.allTickets.length === 0 ? (
                  <p className="text-muted-foreground">
                    No employee data available
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4">
                      <h4 className="font-semibold mb-3">
                        Service Time Distribution
                      </h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={[
                            {
                              name: "Today",
                              avg: report.summary.averageServiceTime || 0,
                            },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar
                            dataKey="avg"
                            fill="#3b82f6"
                            name="Avg Time (sec)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Average service time: {report.summary.averageServiceTime}s
                      per ticket
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="services">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Service category performance and distribution
                </p>
                {report.allTickets.length === 0 ? (
                  <p className="text-muted-foreground">
                    No service data available
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const serviceMap = new Map<
                        string,
                        { total: number; served: number }
                      >();
                      for (const ticket of report.allTickets) {
                        const service = ticket.service || "Uncategorized";
                        if (!serviceMap.has(service)) {
                          serviceMap.set(service, { total: 0, served: 0 });
                        }
                        const stat = serviceMap.get(service)!;
                        stat.total++;
                        if (ticket.status === "done") {
                          stat.served++;
                        }
                      }
                      const services = Array.from(serviceMap.entries())
                        .map(([name, stats]) => ({
                          name,
                          ...stats,
                          rate: Math.round((stats.served / stats.total) * 100),
                        }))
                        .sort((a, b) => b.total - a.total);

                      return (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Service</TableHead>
                              <TableHead className="text-right">
                                Total
                              </TableHead>
                              <TableHead className="text-right">
                                Served
                              </TableHead>
                              <TableHead className="text-right">
                                Completion Rate
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {services.map((service) => (
                              <TableRow key={service.name}>
                                <TableCell className="font-medium">
                                  {service.name}
                                </TableCell>
                                <TableCell className="text-right">
                                  {service.total}
                                </TableCell>
                                <TableCell className="text-right text-green-600 font-medium">
                                  {service.served}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {service.rate}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      );
                    })()}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="skipped">
              {report.skipped.length === 0 ? (
                <p className="text-muted-foreground py-4">
                  No skipped tickets today
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Skipped By</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.skipped.map((skip) => (
                      <TableRow key={skip.ticketId}>
                        <TableCell className="font-medium">
                          {skip.ticketCode}
                        </TableCell>
                        <TableCell>{skip.service}</TableCell>
                        <TableCell>
                          {format(new Date(skip.createdAt), "HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          {skip.skippedByWindowName ||
                            `Window ${skip.skippedByWindow}`}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {skip.remark || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="transfers">
              {report.transfers.length === 0 ? (
                <p className="text-muted-foreground py-4">No transfers today</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.transfers.map((transfer) => (
                      <TableRow key={transfer.transferId}>
                        <TableCell className="font-medium">
                          {transfer.ticketCode}
                        </TableCell>
                        <TableCell>{transfer.service}</TableCell>
                        <TableCell>
                          {format(new Date(transfer.createdAt), "HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          {transfer.fromWindowName ||
                            `Window ${transfer.fromWindow}`}
                        </TableCell>
                        <TableCell>
                          {transfer.toWindowName ||
                            `Window ${transfer.toWindow}`}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {transfer.remark || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

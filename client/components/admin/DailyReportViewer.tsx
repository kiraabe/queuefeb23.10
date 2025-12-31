import { useState, useEffect } from "react";
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
import { AlertCircle, Download, RefreshCw, TrendingUp } from "lucide-react";
import { format } from "date-fns";
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
}

export default function DailyReportViewer() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/daily-report");
      if (!response.ok) {
        throw new Error("Failed to fetch daily report");
      }
      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

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

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-report-${report.reportDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Report</CardTitle>
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
          <CardTitle>Daily Report</CardTitle>
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
          <CardTitle>Daily Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No report data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={fetchReport} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button onClick={downloadCSV} size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Report</CardTitle>
          <CardDescription>
            {format(new Date(report.reportDate), "EEEE, MMMM d, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="windows">Windows</TabsTrigger>
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
                      <TableCell>{window.served}</TableCell>
                      <TableCell>{window.skipped}</TableCell>
                      <TableCell>{window.transfersFrom}</TableCell>
                      <TableCell>{window.transfersTo}</TableCell>
                      <TableCell>
                        {window.averageServiceTime
                          ? `${window.averageServiceTime}s`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

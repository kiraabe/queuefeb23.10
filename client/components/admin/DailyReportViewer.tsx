import { useState, useEffect, useMemo, useRef } from "react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
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

interface OverallAnalytics {
  summary: {
    totalTickets: number;
    served: number;
    skipped: number;
    transferred: number;
    waiting: number;
    serving: number;
    completionRate: number;
    averageServiceTime: number | null;
  };
  employees: Array<{
    employeeId: string;
    employeeName: string;
    totalCasesStarted: number;
    casesCompleted: number;
    casesProceed: number;
    averageCaseTime: number | null;
    totalTimeSpent: number | null;
  }>;
  categories: Array<{
    categoryName: string;
    totalTickets: number;
    served: number;
    skipped: number;
    transferred: number;
    averageServiceTime: number | null;
    completionRate: number;
  }>;
}

export default function DailyReportViewer() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(null);
  const [analytics, setAnalytics] = useState<OverallAnalytics | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Date range state
  const [fromDate, setFromDate] = useState<Date | null>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default to last 30 days
    return d;
  });
  const [toDate, setToDate] = useState<Date | null>(new Date());

  // Window expansion state
  const [expandedWindows, setExpandedWindows] = useState<Set<number>>(new Set());
  const reportContentRef = useRef<HTMLDivElement>(null);

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

    // Also fetch employee stats and overall analytics
    const fetchAdditionalData = async () => {
      try {
        const employeeData = await apiFetch<EmployeeStats>("/api/admin/employee-stats");
        setEmployeeStats(employeeData);
      } catch (err) {
        console.debug("[DailyReportViewer] Error fetching employee stats");
      }

      try {
        const analyticsData = await apiFetch<OverallAnalytics>("/api/admin/overall-analytics");
        setAnalytics(analyticsData);
      } catch (err) {
        console.debug("[DailyReportViewer] Error fetching analytics");
      }
    };

    fetchAdditionalData();
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

  // All detailed tickets (no filtering)
  const filteredTickets = useMemo(() => {
    if (!report) return [];
    return report.detailedTickets;
  }, [report]);

  const downloadPDF = async () => {
    if (!report || generatingPDF) return;

    try {
      setGeneratingPDF(true);

      // Create a temporary container with the report content
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.width = "1200px";
      tempContainer.style.padding = "20px";
      tempContainer.style.backgroundColor = "white";
      tempContainer.style.fontFamily = "'Noto Sans Ethiopic', 'Lexend', sans-serif";

      const avgServiceMinutes = report.summary.averageServiceTime
        ? Math.round(report.summary.averageServiceTime / 60)
        : "N/A";
      const completionRate = report.summary.totalTicketsCreated > 0
        ? `${Math.round((report.summary.served / report.summary.totalTicketsCreated) * 100)}%`
        : "N/A";

      // Build HTML content with proper Amharic font support
      let htmlContent = `
        <div style="font-family: 'Noto Sans Ethiopic', 'Lexend', sans-serif;">
          <h1 style="font-size: 24px; font-weight: bold; text-align: center;">DAILY QUEUE MANAGEMENT SYSTEM</h1>
          <h1 style="font-size: 24px; font-weight: bold; text-align: center;">COMPREHENSIVE REPORT</h1>
          <div style="margin: 20px 0; text-align: center;">
            <p style="font-weight: bold; margin: 5px 0;">Report Period: ${report.reportDate}</p>
            <p style="font-weight: bold; margin: 5px 0;">Generated: ${format(new Date(report.generatedAt), "PPpp")}</p>
          </div>

          <h2 style="font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 12px;">EXECUTIVE SUMMARY</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #f0f0f0;">
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Metric</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Value</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Total Tickets Created</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${report.summary.totalTicketsCreated}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="border: 1px solid #ddd; padding: 8px;">Tickets Served</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${report.summary.served}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Tickets Skipped</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${report.summary.skipped}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="border: 1px solid #ddd; padding: 8px;">Tickets Transferred</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${report.summary.transferred}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Average Service Time</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${avgServiceMinutes} minutes</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="border: 1px solid #ddd; padding: 8px;">Service Completion Rate</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${completionRate}</td>
            </tr>
          </table>
      `;

      // Window Performance
      const activeWindows = (report.windowStats || []).filter((w) => {
        const served = parseInt(String(w.servedTickets)) || 0;
        return served > 0;
      });

      if (activeWindows.length > 0) {
        htmlContent += `<h2 style="font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 12px;">WINDOW PERFORMANCE SUMMARY</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #f0f0f0;">
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Window</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Teller</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Served</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Avg Time</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Performance</td>
            </tr>`;

        activeWindows.forEach((window, idx) => {
          const avgTime = window.averageServiceTime
            ? `${Math.round(window.averageServiceTime / 60)} min`
            : "N/A";
          const performanceLabel = window.performanceLevel === "on_time" ? "✓ On Time" :
                                   window.performanceLevel === "slightly_over" ? "⚠ Slightly Over" :
                                   window.performanceLevel === "moderately_over" ? "⚠ Moderately Over" :
                                   window.performanceLevel === "significantly_over" ? "✕ Significantly Over" : "N/A";
          const bgColor = idx % 2 === 0 ? "#ffffff" : "#f9f9f9";
          htmlContent += `
            <tr style="background-color: ${bgColor};">
              <td style="border: 1px solid #ddd; padding: 8px;">${window.windowName}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${window.tellerName}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${window.servedTickets}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${avgTime}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${performanceLabel}</td>
            </tr>`;
        });
        htmlContent += `</table>`;
      }

      // Employee Performance
      if (analytics && analytics.employees && analytics.employees.length > 0) {
        htmlContent += `<h2 style="font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 12px;">EMPLOYEE PERFORMANCE SUMMARY</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #f0f0f0;">
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Employee</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Started</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Completed</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Avg Time</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Completion %</td>
            </tr>`;

        analytics.employees.slice(0, 10).forEach((emp, idx) => {
          const avgCaseTime = emp.averageCaseTime
            ? `${Math.round(emp.averageCaseTime / 60)} min`
            : "N/A";
          const completionRateEmp = emp.totalCasesStarted > 0
            ? `${Math.round((emp.casesCompleted / emp.totalCasesStarted) * 100)}%`
            : "N/A";
          const bgColor = idx % 2 === 0 ? "#ffffff" : "#f9f9f9";
          htmlContent += `
            <tr style="background-color: ${bgColor};">
              <td style="border: 1px solid #ddd; padding: 8px;">${emp.employeeName}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${emp.totalCasesStarted}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${emp.casesCompleted}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${avgCaseTime}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${completionRateEmp}</td>
            </tr>`;
        });
        htmlContent += `</table>`;
      }

      // Category Performance
      if (analytics && analytics.categories && analytics.categories.length > 0) {
        htmlContent += `<h2 style="font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 12px;">SERVICE CATEGORY PERFORMANCE</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #f0f0f0;">
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Category</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Total</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Served</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Skipped</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Transferred</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Completion %</td>
              <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Avg Time</td>
            </tr>`;

        analytics.categories.forEach((cat, idx) => {
          const avgTime = cat.averageServiceTime
            ? `${Math.round(cat.averageServiceTime / 60)} min`
            : "N/A";
          const bgColor = idx % 2 === 0 ? "#ffffff" : "#f9f9f9";
          htmlContent += `
            <tr style="background-color: ${bgColor};">
              <td style="border: 1px solid #ddd; padding: 8px;">${cat.categoryName}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${cat.totalTickets}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${cat.served}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${cat.skipped}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${cat.transferred}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${cat.completionRate}%</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${avgTime}</td>
            </tr>`;
        });
        htmlContent += `</table>`;
      }

      // Detailed Tickets
      if (report.detailedTickets && report.detailedTickets.length > 0) {
        htmlContent += `<h2 style="font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 12px;">DETAILED TICKETS</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
            <tr style="background-color: #f0f0f0;">
              <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold;">Ticket #</td>
              <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold;">Service</td>
              <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold;">Name</td>
              <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold;">Window</td>
              <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold;">Start</td>
              <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold;">End</td>
              <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold;">Duration</td>
              <td style="border: 1px solid #ddd; padding: 6px; font-weight: bold;">Performance</td>
            </tr>`;

        report.detailedTickets.slice(0, 50).forEach((ticket, idx) => {
          const formatDate = (ts: number | null | undefined) => {
            if (!ts || ts === 0) return "—";
            try {
              return format(new Date(ts), "MM-dd HH:mm");
            } catch {
              return "—";
            }
          };
          const performance = ticket.performanceLevel === "on_time" ? "✓ On Time" :
                             ticket.performanceLevel === "slightly_over" ? "⚠ Slightly Over" :
                             ticket.performanceLevel === "moderately_over" ? "⚠ Moderately Over" :
                             ticket.performanceLevel === "significantly_over" ? "✕ Over" : "—";
          const windowName = (ticket.windowName && ticket.windowName !== "null")
            ? ticket.windowName
            : (ticket.windowId ? `Window ${ticket.windowId}` : "—");
          const duration = formatSeconds(ticket.serviceDurationSeconds);
          const bgColor = idx % 2 === 0 ? "#ffffff" : "#f9f9f9";
          htmlContent += `
            <tr style="background-color: ${bgColor};">
              <td style="border: 1px solid #ddd; padding: 6px;">${ticket.ticketCode}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${ticket.service}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${ticket.ownerName || "—"}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${windowName}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${formatDate(ticket.startedAt)}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${formatDate(ticket.completedAt)}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${duration}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${performance}</td>
            </tr>`;
        });
        htmlContent += `</table>`;
      }

      // Performance Analysis
      htmlContent += `<h2 style="font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 12px;">PERFORMANCE ANALYSIS</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f0f0f0;">
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Performance Level</td>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Count</td>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Percentage</td>
          </tr>`;

      const performanceCounts = {
        on_time: 0,
        slightly_over: 0,
        moderately_over: 0,
        significantly_over: 0,
      };

      report.detailedTickets.forEach((ticket) => {
        if (ticket.performanceLevel && performanceCounts.hasOwnProperty(ticket.performanceLevel)) {
          performanceCounts[ticket.performanceLevel as keyof typeof performanceCounts]++;
        }
      });

      const total = report.detailedTickets.length;
      const perfData = [
        ["✓ On Time", performanceCounts.on_time, `${total > 0 ? Math.round((performanceCounts.on_time / total) * 100) : 0}%`],
        ["⚠ Slightly Over", performanceCounts.slightly_over, `${total > 0 ? Math.round((performanceCounts.slightly_over / total) * 100) : 0}%`],
        ["⚠ Moderately Over", performanceCounts.moderately_over, `${total > 0 ? Math.round((performanceCounts.moderately_over / total) * 100) : 0}%`],
        ["✕ Significantly Over", performanceCounts.significantly_over, `${total > 0 ? Math.round((performanceCounts.significantly_over / total) * 100) : 0}%`],
      ];

      perfData.forEach((row, idx) => {
        const bgColor = idx % 2 === 0 ? "#ffffff" : "#f9f9f9";
        htmlContent += `
          <tr style="background-color: ${bgColor};">
            <td style="border: 1px solid #ddd; padding: 8px;">${row[0]}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${row[1]}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${row[2]}</td>
          </tr>`;
      });

      htmlContent += `
        </table>
        <p style="font-weight: bold; margin-top: 20px;">End of Report</p>
        </div>
      `;

      tempContainer.innerHTML = htmlContent;
      document.body.appendChild(tempContainer);

      // Convert to canvas with Amharic font support
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      document.body.removeChild(tempContainer);

      // Create PDF from canvas
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      const filename = `QueueReport_${report.reportDate.replace(/ /g, "_")}_${format(new Date(), "yyyy-MM-dd_HHmmss")}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setGeneratingPDF(false);
    }
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
    <div className="space-y-8 sm:space-y-12">
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
              onClick={downloadPDF}
              disabled={!report || generatingPDF}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {generatingPDF ? "Generating..." : "Export PDF"}
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

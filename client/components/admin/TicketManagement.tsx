import { useState, useMemo, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Search,
  Filter,
  DownloadCloud,
  CheckCircle,
  SkipForward,
  Clock,
  ArrowRightLeft,
  ChevronDown,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import type { QueueSnapshot, Ticket, ListUsersResponse } from "@shared/api";
import { ProcessFlowChart } from "../teller/ProcessFlowChart";
import { CompletedTicketSummary } from "../teller/CompletedTicketSummary";

export default function TicketManagement() {
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [searchCode, setSearchCode] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useSSE("/api/events", (event) => {
    if (event.type === "init") {
      const snapshot = event.payload as QueueSnapshot;
      setTickets(snapshot.tickets);
    } else if (
      event.type === "ticket.created" ||
      event.type === "ticket.updated"
    ) {
      const ticket = event.payload as Ticket;
      setTickets((prev) => ({ ...prev, [ticket.id]: ticket }));
    }
  });

  const ticketList = Object.values(tickets);
  const today = new Date().toDateString();

  const filteredTickets = useMemo(() => {
    let filtered = ticketList.filter((t) => {
      const ticketDate = new Date(t.createdAt).toDateString();
      return ticketDate === today;
    });

    if (searchCode) {
      filtered = filtered.filter((t) =>
        t.code.includes(searchCode.toUpperCase()),
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((t) => t.status === filterStatus);
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [ticketList, searchCode, filterStatus]);

  const statusCounts = useMemo(() => {
    return {
      all: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today;
      }).length,
      waiting: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "waiting";
      }).length,
      serving: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "serving";
      }).length,
      done: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "done";
      }).length,
      skipped: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "skipped";
      }).length,
      transferred: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "transferred";
      }).length,
    };
  }, [ticketList]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-yellow-100 text-yellow-800";
      case "serving":
        return "bg-blue-100 text-blue-800";
      case "done":
        return "bg-green-100 text-green-800";
      case "skipped":
        return "bg-red-100 text-red-800";
      case "transferred":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle className="h-4 w-4" />;
      case "skipped":
        return <SkipForward className="h-4 w-4" />;
      case "serving":
        return <Clock className="h-4 w-4" />;
      case "transferred":
        return <ArrowRightLeft className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp), "HH:mm:ss");
  };

  const downloadCSV = () => {
    const headers = [
      "Code",
      "Status",
      "Service",
      "Selected Services",
      "Window ID",
      "Customer Name",
      "Woreda",
      "Created At",
      "Started At",
      "Completed At",
      "Notes",
    ];

    const rows = filteredTickets.map((t) => [
      t.code,
      t.status,
      t.service,
      t.selectedServices?.join("; ") || "",
      t.windowId || "",
      t.ownerName || "",
      t.woreda || "",
      format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss"),
      t.startedAt ? format(new Date(t.startedAt), "yyyy-MM-dd HH:mm:ss") : "",
      t.completedAt
        ? format(new Date(t.completedAt), "yyyy-MM-dd HH:mm:ss")
        : "",
      t.notes || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickets-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <CardTitle>Ticket Management</CardTitle>
                <CardDescription>
                  View and manage all tickets issued today
                </CardDescription>
              </div>
              <Button onClick={downloadCSV} variant="outline" size="sm">
                <DownloadCloud className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ticket code..."
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Status Tabs */}
      <Tabs
        value={filterStatus}
        onValueChange={setFilterStatus}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="waiting">
            <Clock className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Waiting</span>
            <span className="sm:hidden">({statusCounts.waiting})</span>
          </TabsTrigger>
          <TabsTrigger value="serving">
            <Clock className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Serving</span>
            <span className="sm:hidden">({statusCounts.serving})</span>
          </TabsTrigger>
          <TabsTrigger value="done">
            <CheckCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Done</span>
            <span className="sm:hidden">({statusCounts.done})</span>
          </TabsTrigger>
          <TabsTrigger value="skipped">
            <SkipForward className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Skipped</span>
            <span className="sm:hidden">({statusCounts.skipped})</span>
          </TabsTrigger>
          <TabsTrigger value="transferred">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Transferred</span>
            <span className="sm:hidden">({statusCounts.transferred})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filterStatus} className="space-y-4">
          {filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {searchCode
                    ? "No tickets match your search"
                    : "No tickets found"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <AdminTicketRow key={ticket.id} ticket={ticket} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Admin Ticket Row Component with Process Flow
interface AdminTicketRowProps {
  ticket: Ticket;
}

function AdminTicketRow({ ticket }: AdminTicketRowProps) {
  const [isExpanded, setIsExpanded] = useState(ticket.status === "done");

  // Fetch all users for transfer info
  const { data: usersData } = useQuery({
    queryKey: ["all-users-admin-tickets"],
    queryFn: () => apiFetch<ListUsersResponse>("/api/admin/users"),
    staleTime: 5 * 60 * 1000,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    usersData?.users.forEach((user) => {
      map.set(user.id, user.fullName || user.username);
    });
    return map;
  }, [usersData]);

  // Fetch workflow data for completed tickets
  const { data: performanceData } = useQuery({
    queryKey: ["admin-case-workflow-process", ticket.id],
    queryFn: async () => {
      const response = await apiFetch(
        `/api/employee/case-workflow?ticketId=${encodeURIComponent(ticket.id)}`,
      );
      return response;
    },
    enabled: ticket.status === "done",
  });

  // Convert performance data to process steps
  const processSteps = useMemo(() => {
    const workflowItems = performanceData?.items;

    const formatTime = (seconds: number | null) => {
      if (!seconds) return "—";
      if (seconds < 60) return `${Math.round(seconds)}s`;
      if (seconds < 3600) {
        const minutes = Math.round(seconds / 60);
        return `${minutes}m`;
      }
      const hours = Math.round(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    };

    const steps = [];
    let stepNumber = 1;

    if (workflowItems && workflowItems.length > 0) {
      workflowItems.forEach((item: any) => {
        let displayName = item.employeeName || "Unknown";
        let displayStatus = item.status || "Started";

        if (item.isArchiver) {
          displayName = `${displayName} (Archiever)`;
        }

        if (item.isTeller) {
          if (item.windowId) {
            displayName = `${displayName} - Window ${item.windowId}`;
          }
          displayStatus = "Proceeded";
        }

        let action: "Started" | "Proceeded" | "Completed" = "Started";
        if (displayStatus === "Completed" || displayStatus === "completed") {
          action = "Completed";
        } else if (
          displayStatus === "Proceeded" ||
          displayStatus === "proceeded"
        ) {
          action = "Proceeded";
        } else if (
          displayStatus === "Retrieved" ||
          displayStatus === "retrieved"
        ) {
          action = "Started";
        }

        steps.push({
          id: item.id,
          number: stepNumber++,
          employeeName: item.employeeName || "Unknown",
          jobTitle: item.jobTitle,
          action: action,
          duration: formatTime(item.durationSeconds),
          durationSeconds: item.durationSeconds,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          windowId: item.windowId,
          isTeller: item.isTeller,
          isArchiver: item.isArchiver,
        });
      });
    }

    return steps;
  }, [performanceData]);

  const getWindowName = (windowId: number | null | undefined) => {
    if (!windowId) return "—";
    return `Window ${windowId}`;
  };

  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const extractReason = (remark: string | undefined) => {
    if (!remark) return null;
    const reasonMatch = remark.match(/Reason:\s*(.+)$/);
    if (reasonMatch) {
      return reasonMatch[1].trim();
    }
    return null;
  };

  const extractSkipReason = (remark: string | undefined) => {
    if (!remark) return null;
    const reasonMatch = remark.match(/Reason:\s*(.+)$/);
    if (reasonMatch) {
      return reasonMatch[1].trim();
    }
    const timeMatch = remark.match(/Skipped by window (\d+) at (.+?)(?:\.|$)/);
    if (timeMatch) {
      const window = timeMatch[1];
      const time = new Date(timeMatch[2]).toLocaleTimeString();
      return `Window ${window} at ${time}`;
    }
    return remark;
  };

  return (
    <div
      className={`rounded-lg border transition-all ${
        ticket.status === "done"
          ? "border-border bg-card"
          : "border-border/50 bg-background/50"
      }`}
    >
      {/* Header - always visible */}
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="font-semibold text-foreground">{ticket.code}</p>
            <p className="text-sm text-muted-foreground">
              {ticket.ownerName || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {ticket.status === "done" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0"
                aria-label={
                  isExpanded
                    ? "Collapse ticket details"
                    : "Expand ticket details"
                }
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </Button>
            )}
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                ticket.status === "done"
                  ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-100"
                  : ticket.status === "skipped"
                    ? "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-100"
                    : ticket.status === "serving"
                      ? "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                      : "bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
              }`}
            >
              {ticket.status}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-current/10 px-3 pb-3 pt-3 space-y-3">
          {/* Transfer Info */}
          {(ticket.transferredFromWindow ||
            ticket.transferredToWindow ||
            ticket.transferredToUserId) && (
            <div className="rounded bg-purple-50/50 p-2 dark:bg-purple-950/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                  Transfer Info
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground font-medium">
                  {ticket.transferredFromWindow
                    ? getWindowName(ticket.transferredFromWindow)
                    : "—"}
                </span>
                <ArrowRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-muted-foreground font-medium">
                  {ticket.transferredToWindow
                    ? getWindowName(ticket.transferredToWindow)
                    : ticket.transferredToUserId
                      ? userMap.get(ticket.transferredToUserId) || "—"
                      : "—"}
                </span>
              </div>
              {ticket.transferredAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(ticket.transferredAt)}</span>
                </div>
              )}
              {ticket.remark && extractReason(ticket.remark) && (
                <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                    Transfer Reason
                  </p>
                  <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                    {extractReason(ticket.remark)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Selected Services */}
          {ticket.selectedServices && ticket.selectedServices.length > 0 && (
            <div className="rounded bg-blue-50/50 p-2 dark:bg-blue-950/20">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Selected Services
              </p>
              <ul className="mt-1 space-y-1">
                {ticket.selectedServices.map((serviceName, index) => (
                  <li
                    key={index}
                    className="text-xs text-blue-600 dark:text-blue-400"
                  >
                    • {serviceName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {ticket.notes && (
            <p className="text-sm text-muted-foreground">
              Notes: {ticket.notes}
            </p>
          )}

          {/* Skip Reason */}
          {ticket.status === "skipped" && ticket.remark && (
            <div className="rounded bg-red-50/50 p-2 dark:bg-red-950/20">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">
                Skip Reason
              </p>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {extractSkipReason(ticket.remark) || "No reason provided"}
              </p>
            </div>
          )}

          {/* Woreda */}
          {ticket.woreda && (
            <p className="text-xs text-muted-foreground">
              Woreda: {ticket.woreda}
            </p>
          )}

          {/* Process Flow Chart for completed tickets */}
          {ticket.status === "done" && (
            <>
              {processSteps.length > 0 ? (
                <ProcessFlowChart ticket={ticket} steps={processSteps} />
              ) : (
                <CompletedTicketSummary ticket={ticket} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

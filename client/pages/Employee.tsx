import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, Package, Zap, LogOut } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { CaseActionDialog } from "@/components/employee/CaseActionDialog";
import type {
  Ticket,
  ListUsersResponse,
  ListJobTitlesResponse,
} from "@shared/api";

interface EmployeeStats {
  receivedToday: number;
  completedToday: number;
  avgProcessingSecondsToday: number | null;
}

interface EmployeeTicketsResponse {
  items: Ticket[];
  total: number;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }

  return secs === 0 ? `${minutes}m` : `${minutes}m ${secs}s`;
}

function calculateDuration(
  startTime: number | null | undefined,
  endTime: number | null | undefined,
): number | null {
  if (!startTime || !endTime) return null;
  return Math.round((endTime - startTime) / 1000);
}

interface TicketRowProps {
  ticket: Ticket;
  onComplete?: (ticketId: string) => void;
  onActionStart?: (ticketId: string, action: "start" | "proceed") => void;
}

interface CaseHistoryRowProps {
  ticket: Ticket;
  userMap?: Map<string, string>;
}

interface PerformanceMetric {
  id: string;
  ticketId: string;
  employeeId: string;
  employeeName: string;
  ticketCode: string;
  startedAt: number | null;
  endedAt: number | null;
  status: "in_progress" | "completed" | "proceeded";
  durationSeconds: number | null;
}

const CaseHistoryRow = ({ ticket, userMap }: CaseHistoryRowProps) => {
  const [performanceDetails, setPerformanceDetails] = useState<
    PerformanceMetric[]
  >([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Fetch performance metrics for this ticket
    apiFetch<{ items: PerformanceMetric[] }>(
      `/api/employee/performance?ticketId=${ticket.id}`,
    )
      .then((data) => setPerformanceDetails(data.items))
      .catch(() => {});
  }, [ticket.id]);

  const isProceed = ticket.proceededAt != null;
  const isComplete = ticket.completedAt != null;

  // For completed cases, show total duration from initiation to completion
  // For proceeded cases, show duration to the point it was forwarded
  // For in-progress cases, show duration to the latest proceed time
  const duration = calculateDuration(
    ticket.startedAt,
    isComplete ? ticket.completedAt : (ticket.proceededAt || ticket.completedAt),
  );
  const status = isComplete
    ? "Completed"
    : isProceed
      ? "Forwarded"
      : "In Progress";
  const statusColor = isComplete
    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
    : isProceed
      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";

  return (
    <div className="space-y-2">
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-lg border border-border/60 bg-card/50 p-3 sm:p-4 hover:bg-card/80 transition-colors cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-display font-semibold text-foreground truncate">
              Ticket {ticket.code}
            </h3>
            <Badge
              className={`text-xs whitespace-nowrap ${statusColor}`}
              variant="secondary"
            >
              {status}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Started:</span>{" "}
                {ticket.startedAt
                  ? new Date(ticket.startedAt).toLocaleTimeString()
                  : "—"}
              </div>
              <div>
                <span className="font-medium">Ended:</span>{" "}
                {ticket.proceededAt || ticket.completedAt
                  ? new Date(
                      ticket.proceededAt || ticket.completedAt || 0,
                    ).toLocaleTimeString()
                  : "—"}
              </div>
              <div>
                <span className="font-medium">Duration:</span>{" "}
                {formatDuration(duration)}
              </div>
              {ticket.transferredToUserId && (
                <div>
                  <span className="font-medium">
                    {isProceed ? "Forwarded To:" : "Last Forwarded To:"}
                  </span>{" "}
                  {userMap?.get(ticket.transferredToUserId) ||
                    ticket.transferredToUserId}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Category:</span>{" "}
              {ticket.serviceCategory || "—"}
            </div>
            {Array.isArray(ticket.selectedServices) &&
              ticket.selectedServices.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Services:</span>{" "}
                  {ticket.selectedServices.join(", ")}
                </div>
              )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="text-sm font-semibold text-foreground">
            {formatDuration(duration)}
          </div>
          <p className="text-xs text-muted-foreground">
            {ticket.startedAt
              ? new Date(ticket.startedAt).toLocaleDateString()
              : "—"}
          </p>
          {performanceDetails.length > 0 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-2">
              {performanceDetails.length} handler
              {performanceDetails.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Performance Details - Workflow Chain */}
      {showDetails && performanceDetails.length > 0 && (
        <div className="ml-0 sm:ml-4 space-y-3 border-l-2 border-blue-200 dark:border-blue-900 pl-4">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Workflow Chain
          </p>
          {performanceDetails.map((perf, index) => {
            const isFirst = index === 0;
            const isCompleted = perf.status === "completed";
            const nextPerf = performanceDetails[index + 1];

            const borderColor = isFirst
              ? "border-green-200 dark:border-green-900"
              : isCompleted
                ? "border-purple-200 dark:border-purple-900"
                : "border-blue-100 dark:border-blue-900";

            const bgColor = isFirst
              ? "bg-green-50 dark:bg-green-950/30"
              : isCompleted
                ? "bg-purple-50 dark:bg-purple-950/30"
                : "bg-blue-50 dark:bg-blue-950/30";

            return (
              <div key={perf.id} className="space-y-2">
                <div className={`rounded-lg border ${borderColor} ${bgColor} p-3 text-xs`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground">
                          {perf.employeeName}
                        </p>
                        {isFirst && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                            Initiated
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                            Completed
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1">
                        <span className="font-medium">Started:</span>{" "}
                        {perf.startedAt
                          ? new Date(perf.startedAt).toLocaleTimeString()
                          : "—"}
                      </p>
                      {perf.endedAt && (
                        <p className="text-muted-foreground">
                          <span className="font-medium">Ended:</span>{" "}
                          {new Date(perf.endedAt).toLocaleTimeString()}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        <span className="font-medium">Status:</span>{" "}
                        {perf.status === "completed"
                          ? "✓ Completed"
                          : perf.status === "proceeded"
                            ? "→ Forwarded"
                            : "⏳ In Progress"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatDuration(perf.durationSeconds)}
                      </p>
                      <p className="text-muted-foreground text-xs">time spent</p>
                    </div>
                  </div>
                </div>
                {perf.status === "proceeded" && nextPerf && (
                  <div className="flex items-center justify-center h-6">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        ↓
                      </span>
                      <span className="text-xs text-muted-foreground">
                        to
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TicketRow = ({ ticket, onComplete, onActionStart }: TicketRowProps) => {
  // For in-progress cases, calculate elapsed time from start until now
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);

  useEffect(() => {
    // Only skip elapsed time if the case is completed (status = 'done')
    // Don't skip if ticket.proceededAt is set from a previous employee
    if (!ticket.employeeStartedAt || ticket.completedAt) {
      setElapsedTime(null);
      return;
    }

    // Update elapsed time every second for in-progress cases
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - ticket.employeeStartedAt!) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    // Initial calculation
    const now = Date.now();
    const elapsed = Math.round((now - ticket.employeeStartedAt) / 1000);
    setElapsedTime(elapsed);

    return () => clearInterval(interval);
  }, [ticket.employeeStartedAt, ticket.completedAt]);

  // Use elapsed time for in-progress, only calculate from start to end for completed cases
  const duration =
    elapsedTime ??
    (ticket.status === "done"
      ? calculateDuration(ticket.employeeStartedAt, ticket.completedAt)
      : null);

  const statusColor =
    ticket.status === "done"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";

  const handleStart = async () => {
    try {
      await apiFetch(`/api/employee/cases/${ticket.id}/start`, {
        method: "POST",
      });
      toast.success("Case started");
      onComplete?.(ticket.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start case",
      );
    }
  };

  const handleProceed = async () => {
    onActionStart?.(ticket.id, "proceed");
  };

  const handleComplete = async () => {
    try {
      await apiFetch(`/api/employee/cases/${ticket.id}/complete`, {
        method: "POST",
      });
      toast.success("Case completed successfully");
      onComplete?.(ticket.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to complete case",
      );
    }
  };

  const isReceived = ticket.status === "transferred";
  const hasStarted = ticket.employeeStartedAt != null;
  const hasProceeded = ticket.proceededAt != null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 rounded-lg border border-border/60 bg-card/50 p-3 sm:p-4 hover:bg-card/80 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-display font-semibold text-foreground truncate">
            Ticket {ticket.code}
          </h3>
          <Badge
            className={`text-xs whitespace-nowrap ${statusColor}`}
            variant="secondary"
          >
            {ticket.status === "done" ? "Completed" : "Received"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Owner: {ticket.ownerName || "—"} · Woreda: {ticket.woreda || "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          Category: {ticket.serviceCategory || "—"}
        </p>
        {Array.isArray(ticket.selectedServices) &&
          ticket.selectedServices.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Services: {ticket.selectedServices.join(", ")}
            </p>
          )}
        {ticket.notes && (
          <p className="text-xs text-muted-foreground mt-1">
            Notes: {ticket.notes}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 text-right">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-foreground">
            {formatDuration(duration)}
          </div>
          {ticket.employeeStartedAt &&
            !ticket.proceededAt &&
            !ticket.completedAt && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  (in progress
                </span>
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">)</span>
              </div>
            )}
        </div>
        {ticket.employeeStartedAt && (
          <p className="text-xs text-muted-foreground">
            {new Date(ticket.employeeStartedAt).toLocaleTimeString()}
          </p>
        )}
        {!ticket.employeeStartedAt && (
          <p className="text-xs text-muted-foreground">—</p>
        )}
        {ticket.employeeStartedAt && ticket.status === "done" && (
          <p className="text-xs text-muted-foreground">
            to {new Date(ticket.completedAt || 0).toLocaleTimeString()}
          </p>
        )}
        {isReceived && (
          <div className="flex gap-2 mt-2">
            {!hasStarted ? (
              <Button size="sm" onClick={handleStart}>
                Start
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={handleProceed} variant="outline">
                  Proceed
                </Button>
                <Button size="sm" onClick={handleComplete}>
                  Complete
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function Employee() {
  const [tab, setTab] = useState<string>("received");
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<"proceed" | null>(null);
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const statsQuery = useQuery({
    queryKey: ["employee-stats"],
    queryFn: () => apiFetch<EmployeeStats>("/api/employee/stats"),
    refetchInterval: 10000,
    enabled: !!user,
  });

  const ticketsQuery = useQuery({
    queryKey: ["employee-tickets", tab],
    queryFn: () =>
      apiFetch<EmployeeTicketsResponse>(
        `/api/employee/tickets?tab=${encodeURIComponent(tab)}`,
      ),
    refetchInterval: 5000,
    enabled: !!user && user.role === "employee" && tab !== "history",
  });

  const historyQuery = useQuery({
    queryKey: ["employee-history"],
    queryFn: () => apiFetch<EmployeeTicketsResponse>("/api/employee/history"),
    refetchInterval: 10000,
    enabled: !!user && user.role === "employee",
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<ListUsersResponse>("/api/admin/users"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const jobTitlesQuery = useQuery({
    queryKey: ["job-titles"],
    queryFn: () => apiFetch<ListJobTitlesResponse>("/api/admin/job-titles"),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const handleCaseCompleted = () => {
    ticketsQuery.refetch();
  };

  const handleCaseAction = (ticketId: string, action: "start" | "proceed") => {
    setSelectedCaseId(ticketId);
    if (action === "proceed") {
      setSelectedAction("proceed");
      setActionDialogOpen(true);
    }
  };

  const stats = statsQuery.data;
  const tickets = ticketsQuery.data?.items || [];

  // Create a map of user IDs to full names for displaying forwarded-to names
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    usersQuery.data?.users.forEach((user) => {
      map.set(user.id, user.fullName || user.username);
    });
    return map;
  }, [usersQuery.data]);

  const getJobTitleName = useMemo(() => {
    if (!user?.jobTitleId || !jobTitlesQuery.data) return null;
    const jobTitle = jobTitlesQuery.data.jobTitles.find(
      (jt) => jt.id === user.jobTitleId,
    );
    return jobTitle?.nameEnglish || jobTitle?.nameAmharic || null;
  }, [user?.jobTitleId, jobTitlesQuery.data]);

  const tabItems = useMemo(() => {
    if (tab === "completed") {
      return tickets
        .filter((t) => t.status === "done")
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    }
    if (tab === "history") {
      const historyTickets = historyQuery.data?.items || [];
      return historyTickets.sort((a, b) => {
        const aTime = a.proceededAt || a.completedAt || 0;
        const bTime = b.proceededAt || b.completedAt || 0;
        return bTime - aTime;
      });
    }
    // received
    return tickets
      .filter((t) => t.status === "transferred")
      .sort((a, b) => (b.transferredAt || 0) - (a.transferredAt || 0));
  }, [tickets, tab, historyQuery.data]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {user?.fullName
                ? `Welcome, ${user.fullName}`
                : "Employee Dashboard"}
            </h1>
            {getJobTitleName && (
              <p className="text-sm text-muted-foreground font-medium">
                {getJobTitleName}
              </p>
            )}
            <p className="text-muted-foreground">
              Track your daily cases and performance metrics
            </p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cases Received
              </CardTitle>
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.receivedToday ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cases Completed
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.completedToday ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg. Processing Time
              </CardTitle>
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDuration(stats?.avgProcessingSecondsToday)}
              </div>
              <p className="text-xs text-muted-foreground">Per case</p>
            </CardContent>
          </Card>
        </div>

        {/* Cases Tab View */}
        <Card>
          <CardHeader>
            <CardTitle>Cases</CardTitle>
            <CardDescription>
              View your received and completed cases for today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList>
                <TabsTrigger value="received">Received Cases</TabsTrigger>
                <TabsTrigger value="completed">Completed Cases</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="received" className="space-y-4 mt-4">
                {ticketsQuery.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading cases...
                  </div>
                ) : tabItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No cases received yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tabItems.map((ticket) => (
                      <TicketRow
                        key={ticket.id}
                        ticket={ticket}
                        onComplete={handleCaseCompleted}
                        onActionStart={handleCaseAction}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4 mt-4">
                {ticketsQuery.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading cases...
                  </div>
                ) : tabItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No cases completed yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tabItems.map((ticket) => (
                      <TicketRow key={ticket.id} ticket={ticket} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4 mt-4">
                {historyQuery.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading case history...
                  </div>
                ) : tabItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No case history yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tabItems.map((ticket) => (
                      <CaseHistoryRow
                        key={ticket.id}
                        ticket={ticket}
                        userMap={userMap}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <CaseActionDialog
        open={actionDialogOpen}
        onOpenChange={setActionDialogOpen}
        caseId={selectedCaseId || ""}
        action={selectedAction}
        onSuccess={handleCaseCompleted}
      />
    </div>
  );
}

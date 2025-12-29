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
import { CheckCircle2, Package, Zap, LogOut, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { StartCaseDialog } from "@/components/employee/StartCaseDialog";
import { CaseActionDialog } from "@/components/employee/CaseActionDialog";
import type { Ticket, ListUsersResponse } from "@shared/api";

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
}

const CaseHistoryRow = ({ ticket }: CaseHistoryRowProps) => {
  const duration = calculateDuration(
    ticket.startedAt,
    ticket.proceededAt || ticket.completedAt,
  );

  const isProceed = ticket.proceededAt != null;
  const isComplete = ticket.completedAt != null;
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 rounded-lg border border-border/60 bg-card/50 p-3 sm:p-4 hover:bg-card/80 transition-colors">
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
          {ticket.jobTitleForProceed && (
            <div>
              <span className="font-medium">Forwarded To:</span>{" "}
              {ticket.jobTitleForProceed}
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
      </div>
    </div>
  );
};

const TicketRow = ({ ticket, onComplete, onActionStart }: TicketRowProps) => {
  // For in-progress cases, calculate elapsed time from start until now
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);

  useEffect(() => {
    if (!ticket.startedAt || ticket.proceededAt || ticket.completedAt) {
      setElapsedTime(null);
      return;
    }

    // Update elapsed time every second for in-progress cases
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - ticket.startedAt!) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    // Initial calculation
    const now = Date.now();
    const elapsed = Math.round((now - ticket.startedAt) / 1000);
    setElapsedTime(elapsed);

    return () => clearInterval(interval);
  }, [ticket.startedAt, ticket.proceededAt, ticket.completedAt]);

  // Use elapsed time for in-progress, otherwise calculate from start to end
  const duration =
    elapsedTime ??
    calculateDuration(
      ticket.startedAt,
      ticket.proceededAt || ticket.completedAt,
    );

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
  const hasStarted = ticket.startedAt != null;
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
          {ticket.startedAt && !ticket.proceededAt && !ticket.completedAt && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                (in progress
              </span>
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">)</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {ticket.startedAt
            ? new Date(ticket.startedAt).toLocaleTimeString()
            : "—"}
        </p>
        {(ticket.proceededAt || ticket.completedAt) && (
          <p className="text-xs text-muted-foreground">
            to{" "}
            {new Date(
              ticket.proceededAt || ticket.completedAt || 0,
            ).toLocaleTimeString()}
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
  const [startCaseOpen, setStartCaseOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<"proceed" | null>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

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
  });

  const ticketsQuery = useQuery({
    queryKey: ["employee-tickets", tab],
    queryFn: () =>
      apiFetch<EmployeeTicketsResponse>(
        `/api/employee/tickets?tab=${encodeURIComponent(tab)}`,
      ),
    refetchInterval: 5000,
  });

  const historyQuery = useQuery({
    queryKey: ["employee-history"],
    queryFn: () => apiFetch<EmployeeTicketsResponse>("/api/employee/history"),
    refetchInterval: 10000,
  });

  const handleCaseStarted = () => {
    ticketsQuery.refetch();
  };

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
              Employee Dashboard
            </h1>
            <p className="text-muted-foreground">
              Track your daily cases and performance metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setStartCaseOpen(true)}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Start Case
            </Button>
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
                      <CaseHistoryRow key={ticket.id} ticket={ticket} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <StartCaseDialog
        open={startCaseOpen}
        onOpenChange={setStartCaseOpen}
        onSuccess={handleCaseStarted}
      />

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

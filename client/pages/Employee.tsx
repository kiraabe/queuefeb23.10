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
import { CheckCircle2, Package, ArrowRight, LogOut } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { CaseActionDialog } from "@/components/employee/CaseActionDialog";
import { HoldCaseDialog } from "@/components/employee/HoldCaseDialog";
import type {
  Ticket,
  ListUsersResponse,
  ListJobTitlesResponse,
} from "@shared/api";

interface EmployeeStats {
  receivedToday: number;
  completedToday: number;
  proceedToday: number;
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

interface PerformanceMetricsResponse {
  items: PerformanceMetric[];
  sumEmployeesDurationSeconds?: number | null;
}

interface CaseHold {
  id: string;
  ticketId: string;
  heldByUserId: string;
  subject: string;
  description: string;
  heldAt: number;
  resumedAt?: number | null;
  holdDurationSeconds?: number | null;
}

const CaseHistoryRow = ({ ticket, userMap }: CaseHistoryRowProps) => {
  const [performanceDetails, setPerformanceDetails] = useState<
    PerformanceMetric[]
  >([]);
  const [holds, setHolds] = useState<CaseHold[]>([]);
  const [sumEmployeesDuration, setSumEmployeesDuration] = useState<
    number | null
  >(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Fetch performance metrics and hold records for this ticket
    apiFetch<PerformanceMetricsResponse>(
      `/api/employee/performance?ticketId=${ticket.id}`,
    )
      .then((data) => {
        setPerformanceDetails(data.items);
        setSumEmployeesDuration(data.sumEmployeesDurationSeconds || null);
      })
      .catch(() => {});

    // Fetch hold records
    apiFetch<{ holds: CaseHold[] }>(`/api/employee/holds?ticketId=${ticket.id}`)
      .then((data) => {
        setHolds(data.holds || []);
      })
      .catch(() => {});
  }, [ticket.id]);

  const isProceed = ticket.proceededAt != null;
  const isComplete = ticket.completedAt != null;
  const hasActiveHold = holds.some((h) => h.resumedAt == null);

  // For completed cases, show total duration from creation to completion (initiation to final)
  // For proceeded cases, show duration to the point it was forwarded
  // For in-progress cases, show duration to the latest proceed time
  const totalDuration = calculateDuration(
    ticket.createdAt,
    isComplete ? ticket.completedAt : ticket.proceededAt || ticket.completedAt,
  );
  const status = isComplete
    ? "Completed"
    : hasActiveHold
      ? "On Hold"
      : isProceed
        ? "Forwarded"
        : "In Progress";
  const statusColor = isComplete
    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
    : hasActiveHold
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
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
                {ticket.completedAt || ticket.proceededAt
                  ? new Date(
                      ticket.completedAt || ticket.proceededAt || 0,
                    ).toLocaleTimeString()
                  : "—"}
              </div>
              <div>
                <span className="font-medium">Total Duration:</span>{" "}
                {formatDuration(totalDuration)}
              </div>
              {sumEmployeesDuration && (
                <div>
                  <span className="font-medium">Employees Total:</span>{" "}
                  {formatDuration(sumEmployeesDuration)}
                </div>
              )}
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
            {(ticket.landCertificateKarta || ticket.landCertificateDigital) && (
              <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                {ticket.landCertificateKarta && (
                  <div className="text-xs bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
                    <span className="font-medium text-blue-700 dark:text-blue-400">
                      Land Cert (ካርታ):
                    </span>{" "}
                    <span className="text-blue-600 dark:text-blue-300">
                      {ticket.landCertificateKarta}
                    </span>
                  </div>
                )}
                {ticket.landCertificateDigital && (
                  <div className="text-xs bg-green-50 dark:bg-green-950/30 p-2 rounded">
                    <span className="font-medium text-green-700 dark:text-green-400">
                      Cert (ካርታ):
                    </span>{" "}
                    <span className="text-green-600 dark:text-green-300">
                      {ticket.landCertificateDigital}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="flex flex-col items-end gap-2">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {formatDuration(totalDuration)}
              </div>
              <p className="text-xs text-muted-foreground">
                {isComplete ? "Total case time" : "Elapsed"}
              </p>
            </div>
            {sumEmployeesDuration && sumEmployeesDuration !== totalDuration && (
              <div className="border-t pt-2">
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {formatDuration(sumEmployeesDuration)}
                </div>
                <p className="text-xs text-muted-foreground">Employees time</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {ticket.createdAt
              ? new Date(ticket.createdAt).toLocaleDateString()
              : "—"}
          </p>
        </div>
      </div>

      {/* Performance Details - Workflow Chain */}
      {showDetails && (performanceDetails.length > 0 || holds.length > 0) && (
        <div className="ml-0 sm:ml-4 space-y-3 border-l-2 border-blue-200 dark:border-blue-900 pl-4">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Workflow Chain
          </p>
          {/* Hold Records */}
          {holds.map((hold) => {
            const holdDurationSeconds = hold.holdDurationSeconds || 0;
            const heldByUserName =
              userMap?.get(hold.heldByUserId) || hold.heldByUserId;

            return (
              <div
                key={hold.id}
                className="rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30 p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground">
                        Case On Hold
                      </p>
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">
                        Paused
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      <span className="font-medium">Held By:</span>{" "}
                      {heldByUserName}
                    </p>
                    <p className="text-muted-foreground mt-1 font-medium">
                      <span className="font-bold">Subject:</span> {hold.subject}
                    </p>
                    {hold.description && (
                      <p className="text-muted-foreground mt-1">
                        <span className="font-medium">Details:</span>{" "}
                        {hold.description}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1">
                      <span className="font-medium">Held at:</span>{" "}
                      {new Date(hold.heldAt).toLocaleTimeString()}
                    </p>
                    {hold.resumedAt && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">Resumed at:</span>{" "}
                        {new Date(hold.resumedAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {formatDuration(holdDurationSeconds)}
                    </p>
                    <p className="text-muted-foreground text-xs">on hold</p>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Employee Performance Details */}
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
                <div
                  className={`rounded-lg border ${borderColor} ${bgColor} p-3 text-xs`}
                >
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
                      <p className="text-muted-foreground text-xs">
                        time spent
                      </p>
                    </div>
                  </div>
                </div>
                {perf.status === "proceeded" && nextPerf && (
                  <div className="flex items-center justify-center h-6">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        ↓
                      </span>
                      <span className="text-xs text-muted-foreground">to</span>
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
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [holds, setHolds] = useState<CaseHold[]>([]);
  const [timeUntilExpiration, setTimeUntilExpiration] = useState<number | null>(null);

  // Debug logging
  useEffect(() => {
    console.log("TicketRow debug:", {
      ticketId: ticket.id,
      code: ticket.code,
      transferredToUserId: ticket.transferredToUserId,
      employeeStartedAt: ticket.employeeStartedAt,
      completedAt: ticket.completedAt,
      proceededAt: ticket.proceededAt,
    });
  }, [ticket]);

  // Fetch hold records to check for active holds
  const fetchHolds = async () => {
    try {
      const data = await apiFetch<{ holds: CaseHold[] }>(
        `/api/employee/holds?ticketId=${ticket.id}`,
      );
      setHolds(data.holds || []);
    } catch (error) {
      console.error("Failed to fetch holds:", error);
    }
  };

  useEffect(() => {
    fetchHolds();
  }, [ticket.id]);

  // Calculate total hold duration from all completed holds
  const totalHoldDurationSeconds = holds.reduce((sum, hold) => {
    return sum + (hold.holdDurationSeconds || 0);
  }, 0);

  // Check if case currently has an active hold
  const hasActiveHold = holds.some((h) => h.resumedAt == null);

  // Calculate time remaining for active hold (72 hours = 259200 seconds)
  const HOLD_EXPIRATION_SECONDS = 72 * 60 * 60;
  useEffect(() => {
    if (!hasActiveHold) {
      setTimeUntilExpiration(null);
      return;
    }

    const activeHold = holds.find((h) => h.resumedAt == null);
    if (!activeHold) return;

    // Update countdown every second
    const interval = setInterval(() => {
      const now = Date.now();
      const heldAt = activeHold.heldAt;
      const expiresAt = heldAt + HOLD_EXPIRATION_SECONDS * 1000;
      const timeRemaining = Math.max(0, expiresAt - now);
      setTimeUntilExpiration(timeRemaining);
    }, 1000);

    // Initial calculation
    const now = Date.now();
    const expiresAt = activeHold.heldAt + HOLD_EXPIRATION_SECONDS * 1000;
    const timeRemaining = Math.max(0, expiresAt - now);
    setTimeUntilExpiration(timeRemaining);

    return () => clearInterval(interval);
  }, [hasActiveHold, holds]);

  // Format time remaining for display
  const formatTimeRemaining = (ms: number | null) => {
    if (ms === null || ms === 0) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    // Only skip elapsed time if the case is completed (status = 'done')
    // Don't skip if ticket.proceededAt is set from a previous employee
    if (!ticket.employeeStartedAt || ticket.completedAt) {
      setElapsedTime(null);
      return;
    }

    // If case is on hold, freeze the timer at current value
    if (hasActiveHold) {
      // Calculate the elapsed time up to the hold point (excluding future hold time)
      const now = Date.now();
      const activeHold = holds.find((h) => h.resumedAt == null);
      if (activeHold) {
        // Elapsed time from start to when hold started
        const elapsedBeforeHold = Math.round(
          (activeHold.heldAt - ticket.employeeStartedAt!) / 1000,
        );
        setElapsedTime(elapsedBeforeHold);
      }
      return; // Don't set up interval while on hold
    }

    // Update elapsed time every second for in-progress cases (not on hold)
    const interval = setInterval(() => {
      const now = Date.now();
      // Total elapsed time since start
      const totalElapsed = Math.round((now - ticket.employeeStartedAt!) / 1000);
      // Subtract hold duration to get active processing time
      const activeElapsed = Math.max(
        0,
        totalElapsed - totalHoldDurationSeconds,
      );
      setElapsedTime(activeElapsed);
    }, 1000);

    // Initial calculation
    const now = Date.now();
    const totalElapsed = Math.round((now - ticket.employeeStartedAt) / 1000);
    const activeElapsed = Math.max(0, totalElapsed - totalHoldDurationSeconds);
    setElapsedTime(activeElapsed);

    return () => clearInterval(interval);
  }, [
    ticket.employeeStartedAt,
    ticket.completedAt,
    hasActiveHold,
    totalHoldDurationSeconds,
    holds,
  ]);

  // Use elapsed time for in-progress, only calculate from start to end for completed cases
  const duration =
    elapsedTime ??
    (ticket.status === "done"
      ? calculateDuration(ticket.employeeStartedAt, ticket.completedAt)
      : null);

  const statusColor =
    ticket.status === "done"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : hasActiveHold
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
        : ticket.status === "on_hold"
          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";

  const handleStart = async () => {
    try {
      await apiFetch(`/api/employee/cases/${ticket.id}/start`, {
        method: "POST",
      });
      toast.success("Case started");
      await fetchHolds();
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
      await fetchHolds();
      onComplete?.(ticket.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to complete case",
      );
    }
  };

  const handleResume = async () => {
    try {
      const response = await apiFetch<any>(
        `/api/employee/cases/${ticket.id}/resume`,
        { method: "POST" },
      );

      // Check if hold has expired
      if (response.holdExpired) {
        toast.error(
          "Cannot resume: 3-day hold period has expired. This case will be automatically cancelled.",
        );
        // Refetch to get updated case status
        await fetchHolds();
        onComplete?.(ticket.id);
        return;
      }

      toast.success("Case resumed successfully");
      // Refetch holds to update the UI immediately
      await fetchHolds();
      onComplete?.(ticket.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to resume case";

      // Check for hold expiration in error message
      if (errorMsg.includes("3-day hold period has expired")) {
        toast.error(
          "Cannot resume: 3-day hold period has expired. This case will be automatically cancelled.",
        );
      } else {
        toast.error(errorMsg);
      }

      // Refetch to ensure UI is in sync
      await fetchHolds();
    }
  };

  const handleHoldSuccess = async () => {
    // Refetch holds immediately to pause the timer
    await fetchHolds();
    onComplete?.(ticket.id);
  };

  const isReceived = ticket.transferredToUserId != null;
  const hasStarted = ticket.employeeStartedAt != null;
  const hasProceeded = ticket.proceededAt != null;
  const isCompleted = ticket.completedAt != null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 rounded-lg border border-border/60 bg-card/50 p-3 sm:p-4 hover:bg-card/80 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-display font-semibold text-foreground truncate">
            Ticket {ticket.code}
          </h3>
          <Badge
            className={`text-xs whitespace-nowrap ${statusColor}`}
            variant="secondary"
          >
            {ticket.status === "done"
              ? "Completed"
              : hasActiveHold
                ? "On Hold"
                : ticket.status === "on_hold"
                  ? "On Hold"
                  : "Received"}
          </Badge>
          {hasActiveHold && timeUntilExpiration !== null && (
            <Badge
              variant="outline"
              className={`text-xs ${
                timeUntilExpiration < 3600000
                  ? "border-red-500 text-red-600 dark:text-red-400"
                  : timeUntilExpiration < 86400000
                    ? "border-orange-500 text-orange-600 dark:text-orange-400"
                    : "border-yellow-500 text-yellow-600 dark:text-yellow-400"
              }`}
            >
              Expires: {formatTimeRemaining(timeUntilExpiration)}
            </Badge>
          )}
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
                  {hasActiveHold ? "(paused" : "(in progress"}
                </span>
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${
                    hasActiveHold
                      ? "bg-yellow-500"
                      : "bg-amber-500 animate-pulse"
                  }`}
                  style={hasActiveHold ? {} : undefined}
                />
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
        {ticket && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {isReceived && !hasStarted && !isCompleted && !hasActiveHold && (
              <Button size="sm" onClick={handleStart}>
                Start
              </Button>
            )}
            {isReceived &&
              hasStarted &&
              !isCompleted &&
              !hasActiveHold &&
              ticket.status !== "on_hold" && (
                <>
                  <Button size="sm" onClick={handleComplete}>
                    Complete
                  </Button>
                  <Button size="sm" onClick={handleProceed} variant="outline">
                    Proceed
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setHoldDialogOpen(true)}
                    variant="outline"
                    className="border-2 border-yellow-500 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-400 dark:hover:bg-yellow-950/20"
                  >
                    ⏸ Hold
                  </Button>
                </>
              )}
            {(hasActiveHold || ticket.status === "on_hold") && isReceived && (
              <Button
                size="sm"
                onClick={handleResume}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Resume
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Hold Case Dialog */}
      <HoldCaseDialog
        ticket={ticket}
        open={holdDialogOpen}
        onOpenChange={setHoldDialogOpen}
        onSuccess={handleHoldSuccess}
      />
    </div>
  );
};

export default function Employee() {
  const [tab, setTab] = useState<string>("received");
  const [timePeriod, setTimePeriod] = useState<"today" | "week" | "month">(
    "today",
  );
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 10;
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
    queryKey: ["employee-history", timePeriod, historyPage],
    queryFn: () => {
      const offset = (historyPage - 1) * itemsPerPage;
      return apiFetch<EmployeeTicketsResponse>(
        `/api/employee/history?timePeriod=${encodeURIComponent(timePeriod)}&limit=${itemsPerPage}&offset=${offset}`,
      );
    },
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

  // Reset history page when time period changes
  useEffect(() => {
    setHistoryPage(1);
  }, [timePeriod]);

  const handleCaseCompleted = () => {
    // Refetch immediately to update the UI
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
    return jobTitle?.nameAmharic || jobTitle?.nameEnglish || null;
  }, [user?.jobTitleId, jobTitlesQuery.data]);

  const tabItems = useMemo(() => {
    if (tab === "history") {
      const historyTickets = historyQuery.data?.items || [];
      return historyTickets.sort((a, b) => {
        const aTime = a.proceededAt || a.completedAt || 0;
        const bTime = b.proceededAt || b.completedAt || 0;
        return bTime - aTime;
      });
    }
    // received (default) - include on_hold cases so they can be resumed
    return tickets
      .filter(
        (t) =>
          t.status === "transferred" ||
          t.status === "serving" ||
          t.status === "on_hold",
      )
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
                Cases Proceeded
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-purple-600 dark:text-purple-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.proceedToday ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Cases Tab View */}
        <Card>
          <CardHeader>
            <CardTitle>Cases</CardTitle>
            <CardDescription>
              View your received cases and case history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList>
                <TabsTrigger value="received">Received Cases</TabsTrigger>
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

              <TabsContent value="history" className="space-y-4 mt-4">
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={timePeriod === "today" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimePeriod("today")}
                  >
                    Today
                  </Button>
                  <Button
                    variant={timePeriod === "week" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimePeriod("week")}
                  >
                    This Week
                  </Button>
                  <Button
                    variant={timePeriod === "month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimePeriod("month")}
                  >
                    This Month
                  </Button>
                </div>

                {historyQuery.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading case history...
                  </div>
                ) : tabItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No case history yet
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {tabItems.map((ticket) => (
                        <CaseHistoryRow
                          key={ticket.id}
                          ticket={ticket}
                          userMap={userMap}
                        />
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {historyQuery.data && historyQuery.data.total > 0 && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          Showing {(historyPage - 1) * itemsPerPage + 1} to{" "}
                          {Math.min(
                            historyPage * itemsPerPage,
                            historyQuery.data.total,
                          )}{" "}
                          of {historyQuery.data.total} cases
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setHistoryPage((p) => Math.max(1, p - 1))
                            }
                            disabled={historyPage === 1}
                          >
                            Previous
                          </Button>
                          <div className="flex items-center gap-2 px-3 py-1 border rounded-md">
                            <span className="text-sm font-medium">
                              {historyPage}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setHistoryPage((p) =>
                                Math.ceil(
                                  historyQuery.data!.total / itemsPerPage,
                                ) > p
                                  ? p + 1
                                  : p,
                              )
                            }
                            disabled={
                              historyPage >=
                              Math.ceil(historyQuery.data!.total / itemsPerPage)
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
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
        currentUserId={user?.id}
      />
    </div>
  );
}

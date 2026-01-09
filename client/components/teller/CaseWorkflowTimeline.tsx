import { useQuery } from "@tanstack/react-query";
import { Ticket } from "@shared/api";
import { apiFetch } from "@/lib/api";
import {
  CheckCircle2,
  ArrowRight,
  Clock,
  User,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EmployeeStep {
  id: string;
  employeeName: string;
  jobTitle: string;
  status: "Started" | "Proceeded" | "Completed" | "Retrieved";
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number | null;
}

interface CaseWorkflowTimelineProps {
  ticket: Ticket;
  compact?: boolean;
}

export function CaseWorkflowTimeline({
  ticket,
  compact = false,
}: CaseWorkflowTimelineProps) {
  const { data: performanceData, isPending } = useQuery({
    queryKey: ["case-workflow", ticket.id],
    queryFn: async () => {
      const response = await apiFetch(
        `/api/employee/case-workflow?ticketId=${encodeURIComponent(ticket.id)}`,
      );
      return response;
    },
    enabled: ticket.status === "done",
  });

  if (ticket.status !== "done") {
    return null;
  }

  if (isPending) {
    return (
      <Card className="mt-4 border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-sm">Case Workflow Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <p className="text-sm text-muted-foreground">Loading workflow...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = performanceData?.items || [];

  if (!items || items.length === 0) {
    return (
      <Card className="mt-4 border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-sm">Case Workflow Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/50 p-4">
            <div className="flex items-start gap-3">
              <div className="text-amber-600 dark:text-amber-400 mt-0.5">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  No employee workflow data available
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  This case was completed directly without going through the
                  employee workflow.
                  {ticket.completedAt && (
                    <>
                      <br />
                      Completed on:{" "}
                      <span className="font-semibold">
                        {new Date(ticket.completedAt).toLocaleString()}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

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

  const formatDateTime = (timestamp: number) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatFullDateTime = (timestamp: number) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "Started":
        return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
      case "Proceeded":
        return "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800";
      case "Completed":
        return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800";
      default:
        return "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "Completed":
        return (
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
        );
      default:
        return (
          <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        );
    }
  };

  const totalDuration = items.reduce((sum, item) => {
    return sum + (item.durationSeconds || 0);
  }, 0);

  if (compact) {
    // Compact view for inline display
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {items.map((step, index) => (
            <div key={step.id} className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1">
                <span className="text-xs font-medium text-foreground">
                  {step.employeeName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(step.durationSeconds)}
                </span>
              </div>
              {index < items.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className="mt-4 border-border/70 bg-gradient-to-br from-card via-card to-card/90">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Case Workflow Timeline</CardTitle>
          <div className="rounded-full bg-primary/10 px-3 py-1">
            <p className="text-xs font-semibold text-primary">
              {items.length} step{items.length !== 1 ? "s" : ""} •{" "}
              {formatTime(totalDuration)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((step, index) => (
            <div key={step.id}>
              <div
                className={`rounded-lg border-2 p-4 transition-all hover:shadow-md ${getActionColor(
                  step.status,
                )}`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0">
                    {getActionIcon(step.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground truncate">
                            {step.employeeName || "Unknown Employee"}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                              step.status === "Completed"
                                ? "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100"
                                : step.status === "Proceeded"
                                  ? "bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-100"
                                  : "bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                          <Briefcase className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {step.jobTitle || "No Title"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 bg-background/40 rounded px-2 py-1.5">
                        <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Duration
                          </p>
                          <p className="font-semibold text-foreground">
                            {formatTime(step.durationSeconds)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-background/40 rounded px-2 py-1.5">
                        <User className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Started At
                          </p>
                          <p className="font-semibold text-foreground text-xs">
                            {formatDateTime(step.startedAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {step.endedAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Ended at:{" "}
                        <span className="font-medium text-foreground">
                          {formatDateTime(step.endedAt)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {index < items.length - 1 && (
                <div className="flex justify-center py-3">
                  <div className="relative flex items-center">
                    <ArrowRight className="h-5 w-5 rotate-90 text-primary/40" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total Participants
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {items.length}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total Duration
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {formatTime(totalDuration)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Case Status
              </p>
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="font-bold text-green-600 dark:text-green-400">
                  Completed
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

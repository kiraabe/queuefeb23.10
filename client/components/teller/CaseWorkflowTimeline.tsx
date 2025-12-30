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
  status: "Started" | "Proceeded" | "Completed";
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
          <CardTitle className="text-sm">Case Workflow</CardTitle>
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
    return null;
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

  return (
    <Card className="mt-4 border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle className="text-sm">Case Workflow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((step, index) => (
            <div key={step.id}>
              <div
                className={`rounded-lg border-2 p-4 ${getActionColor(step.status)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getActionIcon(step.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {step.employeeName || "Unknown Employee"}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Briefcase className="h-3 w-3" />
                          {step.jobTitle || "No Title"}
                        </p>
                      </div>
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-medium whitespace-nowrap ml-2 ${
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

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {formatTime(step.durationSeconds)}
                        </span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {formatDateTime(step.startedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {index < items.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowRight className="h-5 w-5 rotate-90 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Total participants:</strong> {items.length}{" "}
            {items.length === 1 ? "employee" : "employees"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

import { useQuery } from "@tanstack/react-query";
import type { Ticket } from "@shared/api";
import { apiFetch } from "@/lib/api";
import {
  ArrowRight,
  Clock,
  User,
  Briefcase,
  Activity,
  CheckCircle2,
} from "lucide-react";

interface EmployeeStep {
  id: string;
  employeeName: string;
  jobTitle: string;
  status: "Started" | "Proceeded" | "Completed" | "Retrieved";
  durationSeconds: number | null;
  windowId?: number | null;
  isTeller?: boolean;
  isArchiver?: boolean;
}

interface CompletedTicketSummaryProps {
  ticket: Ticket;
}

export function CompletedTicketSummary({
  ticket,
}: CompletedTicketSummaryProps) {
  const {
    data: performanceData,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["case-workflow-summary", ticket.id],
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
      <div className="mt-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-3 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200/50 dark:border-green-900/50">
        <p className="text-xs text-green-700 dark:text-green-300">
          Loading workflow...
        </p>
      </div>
    );
  }

  const items = performanceData?.items || [];

  if (!items || items.length === 0) {
    // Show a fallback message when there's no workflow data (e.g., direct completion)
    return (
      <div className="mt-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 p-3 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-900/50">
        <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
          ✓ Completed
        </p>
        {ticket.completedAt && (
          <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
            {new Date(ticket.completedAt).toLocaleString()}
          </p>
        )}
      </div>
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

  const totalDuration = items.reduce((sum, item) => {
    return sum + (item.durationSeconds || 0);
  }, 0);

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-3 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200/50 dark:border-green-900/50">
      {/* Flow visualization */}
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((step, index) => (
          <div key={step.id} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300 whitespace-nowrap truncate max-w-[100px]">
                  {step.employeeName}
                </span>
              </div>
              <span className="text-xs text-green-600/70 dark:text-green-400/70">
                {formatTime(step.durationSeconds)}
              </span>
            </div>
            {index < items.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 text-green-400 dark:text-green-600 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-2 flex items-center gap-2 border-t border-green-200/50 dark:border-green-900/50 pt-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
        <span className="text-xs text-green-700 dark:text-green-300 font-medium">
          {items.length} employee{items.length !== 1 ? "s" : ""} • Total:{" "}
          <span className="font-semibold">{formatTime(totalDuration)}</span>
        </span>
      </div>
    </div>
  );
}

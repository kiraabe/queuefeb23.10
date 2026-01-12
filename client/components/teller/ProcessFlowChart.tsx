import type { Ticket } from "@shared/api";

interface ProcessStep {
  id: string;
  number: number;
  employeeName: string;
  jobTitle?: string;
  action: "Started" | "Proceeded" | "Completed";
  duration: string;
  durationSeconds: number | null;
  startedAt?: number | null;
  endedAt?: number | null;
}

interface ProcessFlowChartProps {
  ticket: Ticket;
  steps: ProcessStep[];
}

export function ProcessFlowChart({ ticket, steps }: ProcessFlowChartProps) {
  if (!steps || steps.length === 0) {
    return null;
  }

  const totalDuration = steps.reduce((sum, step) => {
    return sum + (step.durationSeconds || 0);
  }, 0);

  const formatTotalTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) {
      const minutes = Math.round(seconds / 60);
      return `${minutes}m`;
    }
    const hours = Math.round(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "Completed":
        return "bg-green-100 dark:bg-green-900/30";
      case "Proceeded":
        return "bg-blue-100 dark:bg-blue-900/30";
      default:
        return "bg-purple-100 dark:bg-purple-900/30";
    }
  };

  const getActionBgColor = (action: string) => {
    switch (action) {
      case "Completed":
        return "bg-green-500 dark:bg-green-600";
      case "Proceeded":
        return "bg-blue-500 dark:bg-blue-600";
      default:
        return "bg-purple-500 dark:bg-purple-600";
    }
  };

  const formatDateTime = (timestamp: number | null | undefined) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString([], { month: "short", day: "numeric" }),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  return (
    <div className="mt-4 rounded-lg border border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
            ✓
          </span>
          Process Flow
        </h3>
        <span className="text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
          Total: {formatTotalTime(totalDuration)}
        </span>
      </div>

      {/* Process flow visualization */}
      <div className="relative">
        {/* Horizontal flow container */}
        <div className="flex items-stretch gap-0">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-1 items-stretch">
              {/* Step box */}
              <div
                className={`flex-1 rounded-lg border-2 border-green-300 dark:border-green-700 ${getActionColor(step.action)} p-3 flex flex-col items-center justify-between gap-2 relative`}
              >
                {/* Step number circle */}
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${getActionBgColor(step.action)}`}
                >
                  {step.number}
                </div>

                {/* Employee name */}
                <p className="text-xs font-semibold text-center text-foreground max-w-24 line-clamp-2">
                  {step.employeeName}
                </p>

                {/* Job title */}
                {step.jobTitle && (
                  <p className="text-xs text-muted-foreground text-center max-w-24 line-clamp-2">
                    {step.jobTitle}
                  </p>
                )}

                {/* Action label */}
                <span className="text-xs font-medium text-muted-foreground">
                  {step.action}
                </span>

                {/* Timestamp - started time */}
                {step.startedAt && (
                  <div className="rounded bg-blue-50 dark:bg-blue-950/30 px-2 py-1 w-full text-center border border-blue-200 dark:border-blue-800 space-y-0.5">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Started
                    </p>
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      {formatDateTime(step.startedAt)?.time}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {formatDateTime(step.startedAt)?.date}
                    </p>
                  </div>
                )}

                {/* Duration */}
                <div className="rounded bg-white/50 dark:bg-black/20 px-2 py-1">
                  <p className="text-xs font-semibold text-foreground">
                    {step.duration}
                  </p>
                </div>
              </div>

              {/* Arrow connector (except after last step) */}
              {index < steps.length - 1 && (
                <div className="flex items-center -mx-2 z-10">
                  <div className="h-6 w-6 rounded-full bg-green-400 dark:bg-green-600 flex items-center justify-center text-white">
                    <span className="text-xs">→</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary info */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
        <div>
          <p className="text-muted-foreground font-medium">Steps</p>
          <p className="text-lg font-bold text-foreground">{steps.length}</p>
        </div>
        <div>
          <p className="text-muted-foreground font-medium">Status</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            ✓ Done
          </p>
        </div>
        <div>
          <p className="text-muted-foreground font-medium">Started</p>
          <p className="text-xs font-medium text-muted-foreground">
            {steps.length > 0 && steps[0]?.startedAt
              ? new Date(steps[0].startedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground font-medium">Completed</p>
          <p className="text-xs font-medium text-muted-foreground">
            {ticket.completedAt
              ? new Date(ticket.completedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

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
  windowId?: number | null;
  isTeller?: boolean;
  isArchiver?: boolean;
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

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "Completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "Proceeded":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">
          Process Flow ({steps.length} steps • {formatTotalTime(totalDuration)})
        </span>
      </div>

      {/* Simple List */}
      <div className="space-y-1.5">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent/40 text-xs">
            {/* Step number */}
            <span className="font-semibold text-muted-foreground w-6 flex-shrink-0">
              {step.number}.
            </span>

            {/* Employee name */}
            <span className="font-medium text-foreground flex-1 min-w-0 truncate">
              {step.employeeName}
            </span>

            {/* Job title if available */}
            {step.jobTitle && (
              <span className="text-muted-foreground truncate max-w-[150px]">
                {step.jobTitle}
              </span>
            )}

            {/* Window info if teller */}
            {step.isTeller && step.windowId && (
              <span className="text-muted-foreground flex-shrink-0">
                W{step.windowId}
              </span>
            )}

            {/* Duration */}
            <span className="font-medium text-foreground flex-shrink-0 w-12 text-right">
              {step.duration}
            </span>

            {/* Action badge */}
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getActionBadgeColor(step.action)}`}
            >
              {step.action}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    <div className="mt-3 bg-card rounded-lg border border-border p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">
          Process Flow ({steps.length} steps • {formatTotalTime(totalDuration)})
        </span>
      </div>

      {/* Horizontal Flow */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-3 min-w-min pb-1">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3">
              {/* Step Card */}
              <div className="flex items-center gap-2 px-3 py-2 rounded border border-border/50 bg-background/50 whitespace-nowrap text-xs flex-shrink-0">
                <span className="font-semibold text-muted-foreground">
                  {step.number}.
                </span>
                <span className="font-medium text-foreground max-w-[120px] truncate">
                  {step.employeeName}
                </span>
                <span className="text-muted-foreground">
                  {step.duration}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${getActionBadgeColor(step.action)}`}
                >
                  {step.action}
                </span>
              </div>

              {/* Arrow (except last step) */}
              {index < steps.length - 1 && (
                <span className="text-muted-foreground/60 text-lg flex-shrink-0">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

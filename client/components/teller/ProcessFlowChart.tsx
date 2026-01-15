import type { Ticket } from "@shared/api";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

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

  const getStepIcon = (action: string) => {
    switch (action) {
      case "Completed":
        return "✓";
      case "Proceeded":
        return "→";
      default:
        return "◉";
    }
  };

  const getStepColor = (action: string) => {
    switch (action) {
      case "Completed":
        return "bg-green-500 dark:bg-green-600 text-white";
      case "Proceeded":
        return "bg-blue-500 dark:bg-blue-600 text-white";
      default:
        return "bg-purple-500 dark:bg-purple-600 text-white";
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
    <div className="mt-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Process Timeline
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {steps.length} step{steps.length !== 1 ? "s" : ""} • Total time:{" "}
            <span className="font-semibold text-foreground">
              {formatTotalTime(totalDuration)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
          <span className="text-green-700 dark:text-green-300 font-semibold text-sm">
            ✓ Completed
          </span>
        </div>
      </div>

      {/* Timeline steps */}
      <div className="space-y-2">
        {steps.map((step, index) => {
          const isExpanded = expandedStep === step.id;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id}>
              {/* Step connector line (except for last step) */}
              {!isLast && (
                <div className="flex items-start ml-6 h-2">
                  <div className="w-0.5 bg-gradient-to-b from-green-400 to-green-300 dark:from-green-600 dark:to-green-700 h-full" />
                </div>
              )}

              {/* Step card */}
              <button
                onClick={() =>
                  setExpandedStep(isExpanded ? null : step.id)
                }
                className="w-full text-left transition-all duration-200"
              >
                <div className="flex gap-4 items-start hover:bg-accent/50 dark:hover:bg-accent/20 p-3 rounded-lg group">
                  {/* Step circle */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getStepColor(step.action)} shadow-sm group-hover:shadow-md transition-all duration-200`}
                  >
                    {getStepIcon(step.action)}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                          {step.employeeName}
                        </h4>
                        {step.jobTitle && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {step.jobTitle}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-medium text-foreground">
                            {step.duration}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {step.action}
                          </p>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && step.startedAt && (
                <div className="ml-14 mb-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Started
                      </p>
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        {formatDateTime(step.startedAt)?.time}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {formatDateTime(step.startedAt)?.date}
                      </p>
                    </div>
                    {step.endedAt && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Completed
                        </p>
                        <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                          {formatDateTime(step.endedAt)?.time}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          {formatDateTime(step.endedAt)?.date}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Total Steps
            </p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-2">
              {steps.length}
            </p>
          </div>
          <div className="border-l border-r border-green-200 dark:border-green-800">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Total Time
            </p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-2">
              {formatTotalTime(totalDuration)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status
            </p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300 mt-2">
              ✓ Done
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Ticket } from "@shared/api";
import { useState } from "react";
import {
  ChevronDown,
  ArrowRight,
  Clock,
  Briefcase,
  Monitor,
} from "lucide-react";

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
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="mt-4 space-y-2">
      {/* Horizontal Flow - Compact Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">
          {steps.length} step{steps.length !== 1 ? "s" : ""} • {formatTotalTime(totalDuration)}
        </div>
      </div>

      {/* Horizontal Process Flow */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 min-w-min pb-2">
          {steps.map((step, index) => {
            const isExpanded = expandedStep === step.id;

            return (
              <div key={step.id} className="flex items-center">
                {/* Step Card */}
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="group flex-shrink-0 w-32 hover:bg-accent/30 rounded-lg p-2 transition-all duration-200 text-left border border-border/50 hover:border-primary/50"
                >
                  <div className="space-y-1">
                    {/* Step indicator and icon */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white ${getStepColor(step.action)} shadow-sm`}
                      >
                        {getStepIcon(step.action)}
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {step.number}
                      </span>
                    </div>

                    {/* Employee name - truncated */}
                    <p className="text-xs font-semibold text-foreground truncate">
                      {step.employeeName}
                    </p>

                    {/* Duration and action */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">
                        {step.duration}
                      </span>
                      <ChevronDown
                        className={`w-3 h-3 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {/* Expanded Details - Popover under step */}
                {isExpanded && (
                  <div className="absolute z-20 ml-0 mt-0 w-64 bg-white dark:bg-slate-900 border border-border rounded-lg shadow-lg p-3 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-2">
                      {/* Employee Info */}
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {step.employeeName}
                        </p>
                        {step.jobTitle && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Briefcase className="h-3 w-3" />
                            {step.jobTitle}
                          </p>
                        )}
                      </div>

                      {/* Window info if teller */}
                      {step.isTeller && step.windowId && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Monitor className="h-3 w-3" />
                          Window {step.windowId}
                        </p>
                      )}

                      {/* Time Info */}
                      {step.startedAt && (
                        <div className="border-t border-border pt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">
                                Started
                              </p>
                              <p className="text-xs font-semibold text-foreground">
                                {formatDateTime(step.startedAt)}
                              </p>
                            </div>
                            {step.endedAt && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground">
                                  Ended
                                </p>
                                <p className="text-xs font-semibold text-foreground">
                                  {formatDateTime(step.endedAt)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Duration */}
                      <div className="border-t border-border pt-2 flex items-center gap-2">
                        <Clock className="h-3 w-3 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Duration
                          </p>
                          <p className="text-xs font-semibold text-foreground">
                            {step.duration}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Arrow connector (except last step) */}
                {index < steps.length - 1 && (
                  <div className="flex-shrink-0 mx-1 text-muted-foreground/50">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer - Compact */}
      <div className="pt-1 flex items-center justify-between text-xs border-t border-border/50">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{formatTotalTime(totalDuration)}</span>
          </span>
          <span className="text-muted-foreground">
            Steps: <span className="font-semibold text-foreground">{steps.length}</span>
          </span>
        </div>
        <span className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
          ✓ Completed
        </span>
      </div>
    </div>
  );
}

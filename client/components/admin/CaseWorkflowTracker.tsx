import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { ProcessFlowChart } from "../teller/ProcessFlowChart";
import type { Ticket } from "@shared/api";

interface WorkflowEntry {
  id: string;
  ticketId: string;
  employeeId: string;
  jobTitleId: string;
  startedAt: number | null;
  endedAt: number | null;
  status: "in_progress" | "proceeded" | "completed";
  durationSeconds: number | null;
  employeeName: string;
  jobTitle: string;
  ticketCode: string;
  isArchiever?: boolean;
  isTeller?: boolean;
  isWindowService?: boolean;
  windowId?: number | null;
  windowServiceDuration?: number | null;
}

interface TicketInfo {
  ticketCode: string;
  serviceCategory?: string;
  selectedServices?: string[];
}

interface CaseWorkflow {
  ticketId: string;
  ticketCode: string;
  createdAt?: number | null;
  status?: string;
  ticketInfo?: TicketInfo;
  items: WorkflowEntry[];
  totalDuration: number | null;
}

type Timeframe = "today" | "week" | "month" | "all-time";

interface CaseWorkflowTrackerProps {
  defaultTimeframe?: Timeframe;
}

const formatSeconds = (seconds: number | null) => {
  if (seconds === null || seconds === 0) return "N/A";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}hr ${minutes}min ${secs}sec`;
  } else if (minutes > 0) {
    return `${minutes}min ${secs}sec`;
  } else {
    return `${secs}sec`;
  }
};

// Process Step interface for ProcessFlowChart
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

const convertToProcessSteps = (items: WorkflowEntry[]): ProcessStep[] => {
  return items.map((item, index) => {
    let displayName = item.employeeName || "Unknown";
    let displayStatus = item.status || "Started";

    // For archiver steps, use a descriptive label
    if (item.isArchiever) {
      displayName = `${displayName} (Archiever)`;
    }

    // For teller steps, include window number and use a descriptive label
    if (item.isTeller) {
      if (item.windowId) {
        displayName = `${displayName} - Window ${item.windowId}`;
      }
      // Ensure teller action is "Proceeded"
      displayStatus = "Proceeded";
    }

    // Map backend status to action status
    let action: "Started" | "Proceeded" | "Completed" = "Started";
    if (displayStatus === "Completed" || displayStatus === "completed") {
      action = "Completed";
    } else if (displayStatus === "Proceeded" || displayStatus === "proceeded") {
      action = "Proceeded";
    } else if (displayStatus === "Retrieved" || displayStatus === "retrieved") {
      // Treat Retrieved as Started for process flow (archiver retrieving documents)
      action = "Started";
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

    return {
      id: item.id,
      number: index + 1,
      employeeName: item.employeeName,
      jobTitle: item.jobTitle,
      action,
      duration: formatTime(item.durationSeconds),
      durationSeconds: item.durationSeconds,
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      windowId: item.windowId,
      isTeller: item.isTeller,
      isArchiver: item.isArchiever,
    };
  });
};

export default function CaseWorkflowTracker({
  defaultTimeframe = "today",
}: CaseWorkflowTrackerProps = {}) {
  const [workflows, setWorkflows] = useState<CaseWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>(defaultTimeframe);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 5;

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        setError(null);

        const offset = (currentPage - 1) * itemsPerPage;
        const workflowsRes = await apiFetch<any>(
          `/api/employee/case-workflows?timeframe=${timeframe}&limit=${itemsPerPage}&offset=${offset}`,
        );

        if (workflowsRes.items && workflowsRes.items.length > 0) {
          setWorkflows(workflowsRes.items);
          setTotalItems(workflowsRes.total || 0);
        } else {
          setError("No cases found for this timeframe");
          setWorkflows([]);
        }
      } catch (err) {
        console.error("Failed to fetch workflows:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch case workflow data",
        );
        setWorkflows([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, [timeframe, currentPage]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    if (canGoPrevious) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (canGoNext) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Filter Controls Card */}
      <Card className="border-2 border-blue-200 dark:border-blue-900 w-full">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                Process Flow Section
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300 mt-2">
                Track case workflows for all statuses (Completed, Skipped, Serving, On Hold) from ticket creation through
                document retrieval by archivers and service delivery by tellers,
                with timeframe filtering and pagination
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Timeframe Filter Buttons */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {(["today", "week", "month", "all-time"] as Timeframe[]).map(
                (tf) => (
                  <Button
                    key={tf}
                    onClick={() => handleTimeframeChange(tf)}
                    variant={timeframe === tf ? "default" : "outline"}
                    className={
                      timeframe === tf
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950"
                    }
                  >
                    {tf === "today"
                      ? "Today"
                      : tf === "week"
                        ? "This Week"
                        : tf === "month"
                          ? "This Month"
                          : "All Time"}
                  </Button>
                ),
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              Loading process flow cases...
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{error}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Process flow will display once cases are processed (completed, skipped, serving, or on hold)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflows List */}
      {!loading && !error && workflows.length > 0 && (
        <>
          {workflows.map((workflow) => (
            <WorkflowCard key={workflow.ticketId} workflow={workflow} />
          ))}

          {/* Pagination Controls */}
          <Card className="border-2 border-blue-200 dark:border-blue-900">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing{" "}
                  {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} -{" "}
                  {Math.min(currentPage * itemsPerPage, totalItems)} of{" "}
                  {totalItems} {totalItems === 1 ? "case" : "cases"}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handlePreviousPage}
                    disabled={!canGoPrevious}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    onClick={handleNextPage}
                    disabled={!canGoNext}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// Workflow Card Component
function WorkflowCard({ workflow }: { workflow: CaseWorkflow }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const processSteps = useMemo(
    () => convertToProcessSteps(workflow.items),
    [workflow.items],
  );

  // Create a dummy ticket object for ProcessFlowChart
  const dummyTicket: Ticket = {
    id: workflow.ticketId,
    code: workflow.ticketCode,
    status: "done",
    service: workflow.ticketInfo?.serviceCategory || "Service",
    ownerName: "",
    woreda: "",
    selectedServices: workflow.ticketInfo?.selectedServices || [],
    createdAt: workflow.createdAt || Date.now(),
    startedAt: workflow.items[0]?.startedAt || null,
    completedAt:
      workflow.items[workflow.items.length - 1]?.endedAt || Date.now(),
    notes: "",
    windowId: null,
    skippedAt: null,
    skippedByWindow: null,
    remark: "",
    transferredAt: null,
    transferredFromWindow: null,
    transferredToWindow: null,
    transferredToUserId: null,
  } as unknown as Ticket;

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-900 w-full">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-t-lg">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                Ticket {workflow.ticketInfo?.ticketCode || workflow.ticketCode}
              </CardTitle>
              {workflow.status && (
                <Badge
                  className={
                    workflow.status === "done"
                      ? "bg-green-600 text-white dark:bg-green-700"
                      : workflow.status === "skipped"
                        ? "bg-orange-600 text-white dark:bg-orange-700"
                        : workflow.status === "serving"
                          ? "bg-blue-600 text-white dark:bg-blue-700"
                          : workflow.status === "on_hold"
                            ? "bg-red-600 text-white dark:bg-red-700"
                            : "bg-gray-600 text-white dark:bg-gray-700"
                  }
                >
                  {workflow.status === "done"
                    ? "Completed"
                    : workflow.status === "skipped"
                      ? "Skipped"
                      : workflow.status === "serving"
                        ? "Serving"
                        : workflow.status === "on_hold"
                          ? "On Hold"
                          : workflow.status}
                </Badge>
              )}
            </div>
            {workflow.createdAt &&
              (() => {
                try {
                  const date = new Date(workflow.createdAt);
                  if (!isNaN(date.getTime())) {
                    return (
                      <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 px-3 py-1 rounded-md whitespace-nowrap">
                        {format(date, "MMM dd, yyyy HH:mm")}
                      </div>
                    );
                  }
                  return null;
                } catch {
                  return null;
                }
              })()}
          </div>
          {workflow.ticketInfo?.serviceCategory && (
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-blue-600 text-white dark:bg-blue-700"
              >
                Service Category
              </Badge>
              <span className="text-sm font-semibold text-foreground">
                {workflow.ticketInfo.serviceCategory}
              </span>
            </div>
          )}
          {workflow.ticketInfo?.selectedServices &&
            workflow.ticketInfo.selectedServices.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">
                  Selected Services:
                </p>
                <div className="flex flex-wrap gap-2">
                  {workflow.ticketInfo.selectedServices.map((service, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="bg-white dark:bg-background text-xs"
                    >
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-6">
        <div className="space-y-4">
          {/* Toggle Button */}
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="outline"
            className="w-full"
          >
            {isExpanded
              ? "Hide Process Flow"
              : `Show Process Flow (${workflow.items.length} steps • ${formatSeconds(workflow.totalDuration)})`}
          </Button>

          {/* Process Flow Chart */}
          {isExpanded && processSteps.length > 0 && (
            <ProcessFlowChart ticket={dummyTicket} steps={processSteps} />
          )}

          {/* Summary Stats */}
          {isExpanded && (
            <div className="pt-4 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Total Employees
                </p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                  {new Set(workflow.items.map((i) => i.employeeId)).size}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Total Employee Time
                </p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                  {formatSeconds(
                    workflow.items.reduce(
                      (sum, item) => sum + (item.durationSeconds || 0),
                      0,
                    ),
                  )}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Total Duration
                </p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                  {formatSeconds(workflow.totalDuration)}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                  Complete
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Avg Step Time
                </p>
                <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400 mt-2">
                  {workflow.totalDuration && workflow.items.length > 0
                    ? formatSeconds(
                        Math.round(
                          workflow.totalDuration / workflow.items.length,
                        ),
                      )
                    : "N/A"}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

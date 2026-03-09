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
import { AlertCircle, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { ProcessFlowChart } from "../teller/ProcessFlowChart";
import type { Ticket, CaseHoldsResponse, ServiceItem } from "@shared/api";

interface WorkflowEntry {
  id: string;
  ticketId: string;
  employeeId: string | null;
  jobTitleId: string;
  startedAt: number | null;
  endedAt: number | null;
  status: "in_progress" | "proceeded" | "completed" | "Skipped" | string;
  durationSeconds: number | null;
  employeeName: string;
  jobTitle: string;
  ticketCode: string;
  isArchiever?: boolean;
  isTeller?: boolean;
  isWindowService?: boolean;
  windowId?: number | null;
  windowServiceDuration?: number | null;
  remark?: string;
  skippedByWindow?: number | null;
}

interface TicketInfo {
  ticketCode: string;
  serviceCategory?: string;
  selectedServices?: string[];
  ticketerName?: string;
  wereda?: string;
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
  action: "Started" | "Proceeded" | "Completed" | "Serving" | "On Hold" | "Skipped";
  duration: string;
  durationSeconds: number | null;
  startedAt?: number | null;
  endedAt?: number | null;
  windowId?: number | null;
  isTeller?: boolean;
  isArchiver?: boolean;
  remark?: string;
  skippedByWindow?: number | null;
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
    let action: "Started" | "Proceeded" | "Completed" | "Serving" | "On Hold" | "Skipped" = "Started";
    if (displayStatus === "Completed" || displayStatus === "completed") {
      action = "Completed";
    } else if (displayStatus === "Proceeded" || displayStatus === "proceeded") {
      action = "Proceeded";
    } else if (displayStatus === "Serving" || displayStatus === "serving") {
      action = "Serving";
    } else if (displayStatus === "On Hold" || displayStatus === "on_hold") {
      action = "On Hold";
    } else if (displayStatus === "Skipped" || displayStatus === "skipped") {
      action = "Skipped";
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
      remark: item.remark,
      skippedByWindow: item.skippedByWindow,
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
  const [serviceStandardTimes, setServiceStandardTimes] = useState<
    Record<string, number>
  >({});
  const itemsPerPage = 5;

  // Load service standard times on mount
  useEffect(() => {
    const loadServiceStandardTimes = async () => {
      try {
        const categoriesRes = await apiFetch<any>(
          "/api/service-categories"
        );

        // Handle different response structures
        let categories = categoriesRes?.categories;
        if (!Array.isArray(categories)) {
          console.warn("Invalid categories response structure:", categoriesRes);
          return;
        }

        const standardTimes: Record<string, number> = {};

        // Load services for each category and collect standard times
        for (const category of categories) {
          try {
            const servicesRes = await apiFetch<any>(
              `/api/service-categories/${category.id}/services`
            );

            // Handle different response structures
            let services = servicesRes?.services;
            if (!Array.isArray(services)) {
              console.warn(
                `Invalid services response structure for category ${category.id}:`,
                servicesRes
              );
              continue;
            }

            services.forEach((service: ServiceItem) => {
              if (service.standardTimeMinutes && service.name) {
                // Use the service name as the key
                standardTimes[service.name] = service.standardTimeMinutes;
              }
            });
          } catch (err) {
            console.debug(
              `Failed to load services for category ${category.id}:`,
              err
            );
          }
        }

        setServiceStandardTimes(standardTimes);
      } catch (err) {
        console.debug("Failed to load service standard times:", err);
        // Don't throw - this is non-critical functionality
      }
    };

    loadServiceStandardTimes();
  }, []);

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
            <WorkflowCard
              key={workflow.ticketId}
              workflow={workflow}
              serviceStandardTimes={serviceStandardTimes}
            />
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
function WorkflowCard({
  workflow,
  serviceStandardTimes,
}: {
  workflow: CaseWorkflow;
  serviceStandardTimes: Record<string, number>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [holdData, setHoldData] = useState<any>(null);
  const [remainingTime, setRemainingTime] = useState<string>("—");

  const HOLD_EXPIRATION_SECONDS = 72 * 60 * 60; // 72 hours

  // Get standard time for selected services
  const getSelectedServicesStandardTime = () => {
    const selectedServices = workflow.ticketInfo?.selectedServices || [];
    if (selectedServices.length === 0) {
      return 0;
    }

    const totalMinutes = selectedServices.reduce((sum, serviceName) => {
      const standardMinutes = serviceStandardTimes[serviceName] || 0;
      return sum + standardMinutes;
    }, 0);

    return totalMinutes;
  };

  // Check if duration exceeds standard time (uses selected services if available, fallback to category)
  const getStandardTimeStatus = () => {
    if (!workflow.totalDuration) {
      return {
        exceeds: false,
        performanceLevel: "on_time" as const,
        standardMinutes: null,
        standardSeconds: null,
        source: null as "category" | "services" | null
      };
    }

    // First priority: check selected services
    const selectedServices = workflow.ticketInfo?.selectedServices || [];
    if (selectedServices.length > 0) {
      const totalMinutes = getSelectedServicesStandardTime();
      if (totalMinutes > 0) {
        const standardSeconds = totalMinutes * 60;
        const percentageOfStandard = (workflow.totalDuration / standardSeconds) * 100;

        let performanceLevel: "on_time" | "slightly_over" | "significantly_over";
        if (percentageOfStandard <= 100) {
          performanceLevel = "on_time";
        } else if (percentageOfStandard <= 120) {
          performanceLevel = "slightly_over";
        } else {
          performanceLevel = "significantly_over";
        }

        const exceeds = workflow.totalDuration > standardSeconds;
        return {
          exceeds,
          performanceLevel,
          standardMinutes: totalMinutes,
          standardSeconds,
          source: "services" as const
        };
      }
    }

    // Fallback: check service category
    const serviceCategory = workflow.ticketInfo?.serviceCategory;
    if (serviceCategory) {
      const standardMinutes = serviceStandardTimes[serviceCategory];
      if (standardMinutes) {
        const standardSeconds = standardMinutes * 60;
        const percentageOfStandard = (workflow.totalDuration / standardSeconds) * 100;

        let performanceLevel: "on_time" | "slightly_over" | "significantly_over";
        if (percentageOfStandard <= 100) {
          performanceLevel = "on_time";
        } else if (percentageOfStandard <= 120) {
          performanceLevel = "slightly_over";
        } else {
          performanceLevel = "significantly_over";
        }

        const exceeds = workflow.totalDuration > standardSeconds;
        return {
          exceeds,
          performanceLevel,
          standardMinutes,
          standardSeconds,
          source: "category" as const
        };
      }
    }

    return {
      exceeds: false,
      performanceLevel: "on_time" as const,
      standardMinutes: null,
      standardSeconds: null,
      source: null as "category" | "services" | null
    };
  };

  // Fetch case hold data for on-hold tickets
  useEffect(() => {
    if (workflow.status === "on_hold") {
      const fetchHoldData = async () => {
        try {
          const response = await apiFetch("/api/employee/holds");
          const data = response as CaseHoldsResponse;
          if (data.holds && Array.isArray(data.holds)) {
            const hold = data.holds.find((h) => h.ticketId === workflow.ticketId);
            if (hold) {
              setHoldData(hold);
            }
          }
        } catch (error) {
          console.error("Failed to fetch hold data:", error);
        }
      };

      fetchHoldData();
      const interval = setInterval(fetchHoldData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [workflow.ticketId, workflow.status]);

  // Calculate remaining time for holds
  useEffect(() => {
    if (workflow.status === "on_hold" && holdData) {
      const updateCountdown = () => {
        const now = Date.now();
        // For active holds (not yet resumed), calculate time remaining until 72-hour expiration
        if (holdData.heldAt && !holdData.resumedAt) {
          const expiresAt = holdData.heldAt + HOLD_EXPIRATION_SECONDS * 1000;
          const remaining = expiresAt - now;

          if (remaining > 0) {
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor(
              (remaining % (1000 * 60 * 60)) / (1000 * 60)
            );
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
            setRemainingTime(`${hours}h ${minutes}m ${seconds}s`);
          } else {
            setRemainingTime("Expired");
          }
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000); // Update every second
      return () => clearInterval(interval);
    }
  }, [holdData, workflow.status]);

  const processSteps = useMemo(
    () => convertToProcessSteps(workflow.items),
    [workflow.items],
  );

  // Create a dummy ticket object for ProcessFlowChart
  const dummyTicket: Ticket = {
    id: workflow.ticketId,
    code: workflow.ticketCode,
    status: (workflow.status === "skipped" ? "skipped" : "done") as any,
    service: workflow.ticketInfo?.serviceCategory || "Service",
    ownerName: workflow.ticketInfo?.ticketerName || "",
    woreda: workflow.ticketInfo?.wereda || "",
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
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <CardTitle className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-100 truncate max-w-[200px] sm:max-w-none">
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
              {(() => {
                const { exceeds, standardMinutes, standardSeconds } = getStandardTimeStatus();
                if (exceeds && standardMinutes) {
                  return (
                    <Badge className="bg-red-600 text-white dark:bg-red-700 flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="hidden xs:inline">⚠️ Time Exceeded</span>
                      <span className="xs:hidden">⚠️ Exceeded</span>
                    </Badge>
                  );
                }
                if (standardSeconds && !exceeds) {
                  return (
                    <Badge className="bg-green-600 text-white dark:bg-green-700 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      <span className="hidden xs:inline">✓ On Time</span>
                      <span className="xs:hidden">✓ OK</span>
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>
            {workflow.createdAt &&
              (() => {
                try {
                  const date = new Date(workflow.createdAt);
                  if (!isNaN(date.getTime())) {
                    return (
                      <div className="text-sm font-medium text-blue-800 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30 px-3 py-1.5 rounded-md border border-blue-200/50 dark:border-blue-800/50 flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 opacity-70" />
                        <span className="hidden sm:inline">{format(date, "MMM dd, yyyy HH:mm")}</span>
                        <span className="sm:hidden">{format(date, "MMM dd, HH:mm")}</span>
                      </div>
                    );
                  }
                  return null;
                } catch {
                  return null;
                }
              })()}
          </div>
          {/* Ticketer Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workflow.ticketInfo?.ticketerName && (
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-white/50 dark:bg-black/20 border border-blue-200 dark:border-blue-700">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Ticketer Full Name
                </p>
                <p className="text-sm font-bold text-foreground">
                  {workflow.ticketInfo.ticketerName}
                </p>
              </div>
            )}
            {workflow.ticketInfo?.wereda && (
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-white/50 dark:bg-black/20 border border-blue-200 dark:border-blue-700">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Wereda (District)
                </p>
                <p className="text-sm font-bold text-foreground">
                  {workflow.ticketInfo.wereda}
                </p>
              </div>
            )}
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
            <>
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
                <div className={`text-center p-4 rounded-lg border ${
                  workflow.status === "on_hold"
                    ? remainingTime === "Expired"
                      ? "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800"
                      : "bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800"
                    : "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800"
                }`}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {workflow.status === "on_hold" ? "Time Remaining" : "Total Duration"}
                  </p>
                  <p className={`text-3xl font-bold mt-2 ${
                    workflow.status === "on_hold"
                      ? remainingTime === "Expired"
                        ? "text-red-600 dark:text-red-400"
                        : "text-orange-600 dark:text-orange-400"
                      : "text-green-600 dark:text-green-400"
                  }`}>
                    {workflow.status === "on_hold" ? remainingTime : formatSeconds(workflow.totalDuration)}
                  </p>
                </div>
                <div className={`text-center p-4 rounded-lg border ${
                  workflow.status === "done"
                    ? "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800"
                    : workflow.status === "skipped"
                      ? "bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800"
                      : workflow.status === "serving"
                        ? "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800"
                        : workflow.status === "on_hold"
                          ? "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800"
                          : "bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800"
                }`}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </p>
                  <p className={`text-3xl font-bold mt-2 ${
                    workflow.status === "done"
                      ? "text-green-600 dark:text-green-400"
                      : workflow.status === "skipped"
                        ? "text-orange-600 dark:text-orange-400"
                        : workflow.status === "serving"
                          ? "text-blue-600 dark:text-blue-400"
                          : workflow.status === "on_hold"
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-600 dark:text-gray-400"
                  }`}>
                    {workflow.status === "done"
                      ? "Complete"
                      : workflow.status === "skipped"
                        ? "Skipped"
                        : workflow.status === "serving"
                          ? "Serving"
                          : workflow.status === "on_hold"
                            ? "On Hold"
                            : workflow.status}
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

              {/* Standard Time Comparison */}
              {(() => {
                const { performanceLevel, standardMinutes, standardSeconds, source } =
                  getStandardTimeStatus();
                const selectedServices = workflow.ticketInfo?.selectedServices || [];

                // Always show the comparison section
                if (standardSeconds) {
                  const percentageOfStandard = Math.round(
                    ((workflow.totalDuration || 0) / standardSeconds) * 100
                  );

                  // Determine background color based on performance level
                  const getBgColor = () => {
                    switch (performanceLevel) {
                      case "on_time":
                        return "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800";
                      case "slightly_over":
                        return "bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800";
                      case "significantly_over":
                        return "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800";
                      default:
                        return "bg-gray-50 dark:bg-gray-950/50 border-gray-200 dark:border-gray-800";
                    }
                  };

                  // Determine progress bar color
                  const getProgressColor = () => {
                    switch (performanceLevel) {
                      case "on_time":
                        return "bg-green-600 dark:bg-green-500";
                      case "slightly_over":
                        return "bg-yellow-600 dark:bg-yellow-500";
                      case "significantly_over":
                        return "bg-red-600 dark:bg-red-500";
                      default:
                        return "bg-gray-600 dark:bg-gray-500";
                    }
                  };

                  // Determine status message and color
                  const getStatusMessage = () => {
                    switch (performanceLevel) {
                      case "on_time":
                        return {
                          text: "Within standard time",
                          color: "text-green-600 dark:text-green-400"
                        };
                      case "slightly_over":
                        return {
                          text: `Slightly over by ${formatSeconds(
                            (workflow.totalDuration || 0) - standardSeconds
                          )} (${percentageOfStandard - 100}%)`,
                          color: "text-yellow-600 dark:text-yellow-400"
                        };
                      case "significantly_over":
                        return {
                          text: `Significantly over by ${formatSeconds(
                            (workflow.totalDuration || 0) - standardSeconds
                          )} (${percentageOfStandard - 100}%)`,
                          color: "text-red-600 dark:text-red-400"
                        };
                      default:
                        return {
                          text: "Unknown",
                          color: "text-gray-600 dark:text-gray-400"
                        };
                    }
                  };

                  const status = getStatusMessage();

                  return (
                    <div className={`mt-4 p-4 rounded-lg border space-y-4 ${getBgColor()}`}>
                      {/* Show selected services with their standard times if available */}
                      {source === "services" && selectedServices.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-muted-foreground">
                            Selected Services Standard Time:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedServices.map((serviceName) => {
                              const serviceTime = serviceStandardTimes[serviceName];
                              return (
                                <div
                                  key={serviceName}
                                  className="flex items-center justify-between p-2 rounded bg-white/50 dark:bg-black/20"
                                >
                                  <span className="text-sm text-muted-foreground">
                                    {serviceName}
                                  </span>
                                  <span className="text-sm font-semibold">
                                    {serviceTime ? `${serviceTime} min` : "N/A"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="border-t border-current opacity-20 my-2"></div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold text-muted-foreground">
                              Total Standard Time: {standardMinutes} minutes
                              ({formatSeconds(standardSeconds)})
                              {source === "services" && (
                                <span className="text-xs ml-2 opacity-75">
                                  (combined from selected services)
                                </span>
                              )}
                              {source === "category" && (
                                <span className="text-xs ml-2 opacity-75">
                                  (from service category)
                                </span>
                              )}
                            </p>
                            {/* Color Level Indicator Badge */}
                            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                              performanceLevel === "on_time"
                                ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : performanceLevel === "slightly_over"
                                  ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  : "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}>
                              {performanceLevel === "on_time" && "✓ On Time"}
                              {performanceLevel === "slightly_over" && "⚠ Slightly Over"}
                              {performanceLevel === "significantly_over" && "✕ Significantly Over"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-2">
                              <div className="flex-1 relative h-4 rounded-full shadow-sm overflow-visible">
                                {/* Gradient background from green (good) to red (bad) */}
                                <div
                                  className="absolute inset-0 rounded-full"
                                  style={{
                                    background: "linear-gradient(to right, rgb(34, 197, 94), rgb(251, 191, 36), rgb(251, 146, 60), rgb(239, 68, 68))",
                                    width: "100%"
                                  }}
                                ></div>

                                {/* Current position indicator */}
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-800 dark:bg-slate-200 rounded-full shadow-lg border-2 border-white dark:border-slate-900 transition-all"
                                  style={{
                                    left: `calc(${Math.min(
                                      ((workflow.totalDuration || 0) /
                                        standardSeconds) *
                                        100,
                                      100
                                    )}% - 8px)`,
                                    zIndex: 10
                                  }}
                                ></div>

                                {/* 100% marker line */}
                                {percentageOfStandard > 100 && (
                                  <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-white dark:bg-slate-900 opacity-70 transition-all"
                                    style={{
                                      left: "100%"
                                    }}
                                  ></div>
                                )}
                              </div>
                              <span className="text-sm font-bold whitespace-nowrap min-w-fit">
                                {percentageOfStandard}%
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            <span className={`${status.color} font-semibold flex items-center gap-1`}>
                              {performanceLevel === "on_time" && <CheckCircle className="h-3 w-3" />}
                              {performanceLevel === "slightly_over" && <AlertTriangle className="h-3 w-3" />}
                              {performanceLevel === "significantly_over" && <AlertTriangle className="h-3 w-3" />}
                              {status.text}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Show message if no standard time is configured
                return (
                  <div className="mt-4 p-4 rounded-lg border bg-gray-50 dark:bg-gray-950/50 border-gray-300 dark:border-gray-700">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Standard Time Not Configured
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          No standard time is set for the selected services.
                          {selectedServices.length > 0
                            ? ` Services: ${selectedServices.join(', ')}`
                            : " Please select services to enable time comparison."}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

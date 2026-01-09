import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ArrowRight,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

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
  ticketInfo?: TicketInfo;
  items: WorkflowEntry[];
  totalDuration: number | null;
}

type Timeframe = "today" | "week" | "month";

const formatSeconds = (seconds: number | null) => {
  if (seconds === null || seconds === 0) return "N/A";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  if (mins > 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}m ${secs}s`;
};

const getStatusColor = (status: "in_progress" | "proceeded" | "completed") => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "proceeded":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusLabel = (status: "in_progress" | "proceeded" | "completed") => {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "proceeded":
      return "Forwarded";
    case "completed":
      return "Completed";
    default:
      return status;
  }
};

export default function CaseWorkflowTracker() {
  const [workflows, setWorkflows] = useState<CaseWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("today");
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
          setError("No completed cases found for this timeframe");
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
                Complete case workflow tracking from ticket creation through
                document retrieval by archivers and service delivery by tellers,
                with timeframe filtering and pagination
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Workflow Legend */}
          <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Process Roles Legend:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex-shrink-0"></div>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Archiever:</span> Document
                  retrieval & verification
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex-shrink-0"></div>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Teller:</span> Service
                  delivery & customer handling
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex-shrink-0"></div>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Employee:</span>{" "}
                  Administrative workflow steps
                </span>
              </div>
            </div>
          </div>

          {/* Timeframe Filter Buttons */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {(["today", "week", "month"] as Timeframe[]).map((tf) => (
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
                      : "This Month"}
                </Button>
              ))}
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
                  Process flow will display once cases are completed
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
            <Card
              key={workflow.ticketId}
              className="border-2 border-blue-200 dark:border-blue-900 w-full"
            >
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-t-lg">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      Ticket{" "}
                      {workflow.ticketInfo?.ticketCode || workflow.ticketCode}
                    </CardTitle>
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
                            {workflow.ticketInfo.selectedServices.map(
                              (service, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="bg-white dark:bg-background text-xs"
                                >
                                  {service}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 pb-6">
                <Accordion
                  type="single"
                  collapsible
                  defaultValue="flow"
                  className="w-full"
                >
                  <AccordionItem value="flow" className="border-none">
                    <AccordionTrigger className="text-base font-semibold text-blue-900 dark:text-blue-100 hover:text-blue-700 dark:hover:text-blue-300 px-0">
                      Horizontal Process Flow Visualization
                    </AccordionTrigger>
                    <AccordionContent className="pt-6 pb-4">
                      <div className="overflow-x-auto">
                        <div className="space-y-8 min-w-max">
                          {/* Horizontal Process Flow */}
                          {workflow.items.length > 0 ? (
                            <div className="space-y-6">
                              {/* Flow Diagram */}
                              <div className="flex items-start gap-2 pb-4">
                                {workflow.items.map((step, index) => (
                                  <div
                                    key={step.id}
                                    className="flex items-start gap-2 flex-shrink-0"
                                  >
                                    {/* Step Node */}
                                    <div className="flex flex-col items-center">
                                      <div
                                        className={`flex items-center justify-center w-14 h-14 rounded-full text-white font-bold text-lg flex-shrink-0 shadow-lg border-4 border-white dark:border-slate-950 ${
                                          step.isArchiever
                                            ? "bg-gradient-to-br from-amber-500 to-amber-600"
                                            : step.isWindowService
                                              ? "bg-gradient-to-br from-teal-500 to-teal-600"
                                              : step.isTeller
                                                ? "bg-gradient-to-br from-cyan-500 to-cyan-600"
                                                : "bg-gradient-to-br from-blue-500 to-blue-600"
                                        }`}
                                      >
                                        {index + 1}
                                      </div>
                                      <div
                                        className={`mt-3 rounded-lg border-2 p-3 min-w-56 hover:shadow-md transition-shadow ${
                                          step.isArchiever
                                            ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50"
                                            : step.isWindowService
                                              ? "border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/50 ring-1 ring-teal-200 dark:ring-teal-800"
                                              : step.isTeller
                                                ? "border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/50"
                                                : "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50"
                                        }`}
                                      >
                                        <div className="space-y-2">
                                          {/* Employee Info */}
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {step.isArchiever && (
                                                <Badge className="bg-amber-600 text-white text-xs">
                                                  Archiver
                                                </Badge>
                                              )}
                                              {step.isWindowService && (
                                                <Badge className="bg-teal-600 text-white text-xs font-semibold">
                                                  Window {step.windowId}
                                                </Badge>
                                              )}
                                              {step.isTeller && !step.isWindowService && (
                                                <Badge className="bg-cyan-600 text-white text-xs">
                                                  Teller
                                                </Badge>
                                              )}
                                              <p className="font-bold text-sm text-foreground line-clamp-2">
                                                {step.employeeName}
                                              </p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                              {step.jobTitle || "N/A"}
                                            </p>
                                          </div>

                                          {/* Status Badge */}
                                          {!step.isArchiever &&
                                            !step.isTeller && (
                                              <Badge
                                                className={`inline-flex items-center gap-1 text-xs ${getStatusColor(step.status)}`}
                                              >
                                                <CheckCircle2 className="h-3 w-3" />
                                                {getStatusLabel(step.status)}
                                              </Badge>
                                            )}
                                          {step.isArchiever && (
                                            <Badge className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                              <CheckCircle2 className="h-3 w-3" />
                                              Documents Retrieved
                                            </Badge>
                                          )}
                                          {step.isWindowService && (
                                            <Badge className="inline-flex items-center gap-1 text-xs bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 font-semibold">
                                              <CheckCircle2 className="h-3 w-3" />
                                              Service Delivered
                                            </Badge>
                                          )}
                                          {step.isTeller && !step.isWindowService && (
                                            <Badge className="inline-flex items-center gap-1 text-xs bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                                              <CheckCircle2 className="h-3 w-3" />
                                              Service Completed
                                            </Badge>
                                          )}

                                          {/* Timeline & Window Service Details */}
                                          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1 text-xs">
                                            {step.startedAt && (
                                              <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                <span className="text-muted-foreground">
                                                  Entered: {format(
                                                    new Date(step.startedAt),
                                                    "HH:mm:ss",
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                            <div className="font-semibold text-teal-600 dark:text-teal-400">
                                              Duration: {formatSeconds(
                                                step.durationSeconds,
                                              )}
                                            </div>
                                            {step.endedAt && (
                                              <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                <span className="text-muted-foreground">
                                                  Proceeded: {format(
                                                    new Date(step.endedAt),
                                                    "HH:mm:ss",
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Arrow to next step */}
                                    {index < workflow.items.length - 1 && (
                                      <div className="flex items-center justify-center px-2 mt-7">
                                        <ArrowRight className="h-6 w-6 text-blue-400 dark:text-blue-500 flex-shrink-0" />
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {/* Final Completion Node */}
                                <div className="flex items-start gap-2 flex-shrink-0 ml-2">
                                  <div className="flex flex-col items-center">
                                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-lg flex-shrink-0 shadow-lg border-4 border-white dark:border-slate-950">
                                      <CheckCircle2 className="h-8 w-8" />
                                    </div>
                                    <div className="mt-3 rounded-lg border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/50 p-3 min-w-48">
                                      <p className="font-bold text-sm text-foreground">
                                        Complete
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-2">
                                        Total Time:
                                      </p>
                                      <p className="font-bold text-green-600 dark:text-green-400 text-sm">
                                        {formatSeconds(workflow.totalDuration)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Summary Stats */}
                              <div className="pt-6 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Total Employees
                                  </p>
                                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                                    {
                                      new Set(
                                        workflow.items.map((i) => i.employeeId),
                                      ).size
                                    }
                                  </p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Archivers Involved
                                  </p>
                                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                                    {
                                      new Set(
                                        workflow.items
                                          .filter((i) => i.isArchiever)
                                          .map((i) => i.employeeId),
                                      ).size
                                    }
                                  </p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Windows Used
                                  </p>
                                  <p className="text-3xl font-bold text-teal-600 dark:text-teal-400 mt-2">
                                    {
                                      new Set(
                                        workflow.items
                                          .filter((i) => i.isWindowService && i.windowId)
                                          .map((i) => i.windowId),
                                      ).size
                                    }
                                  </p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Total Process Time
                                  </p>
                                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                                    {formatSeconds(workflow.totalDuration)}
                                  </p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Process Steps
                                  </p>
                                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                                    {workflow.items.length}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No workflow steps found for this case
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
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
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Page {currentPage} of {totalPages || 1}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!loading && !error && workflows.length === 0 && totalItems === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              No process flow data available for the selected timeframe
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

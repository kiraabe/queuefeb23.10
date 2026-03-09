import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Ticket } from "@shared/api";
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { CompletedTicketSummary } from "./CompletedTicketSummary";
import { ProcessFlowChart } from "./ProcessFlowChart";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ListUsersResponse, ServiceItem } from "@shared/api";

interface EmployeeStep {
  id: string;
  employeeName: string;
  jobTitle: string;
  status: string;
  durationSeconds: number | null;
  windowId?: number | null;
  isTeller?: boolean;
  isArchiver?: boolean;
}

interface CaseWorkflowResponse {
  items?: EmployeeStep[];
}

interface TicketSectionProps {
  items: Ticket[];
  title: string;
  pageSize?: number;
  currentWindowId?: number;
}

export function TicketSection({
  items: allItems,
  title,
  pageSize,
  currentWindowId,
}: TicketSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [serviceStandardTimes, setServiceStandardTimes] = useState<
    Record<string, number>
  >({});

  // Load service categories and standard times
  useEffect(() => {
    const loadServiceStandardTimes = async () => {
      try {
        const categoriesRes = await apiFetch<any>(
          "/api/service-categories"
        );

        let categories = categoriesRes?.categories;
        if (!Array.isArray(categories)) {
          return;
        }

        const standardTimes: Record<string, number> = {};

        for (const category of categories) {
          try {
            const servicesRes = await apiFetch<any>(
              `/api/service-categories/${category.id}/services`
            );

            let services = servicesRes?.services;
            if (!Array.isArray(services)) {
              continue;
            }

            services.forEach((service: ServiceItem) => {
              if (service.standardTimeMinutes && service.name) {
                standardTimes[service.name] = service.standardTimeMinutes;
              }
            });
          } catch {
            // Silent fail for individual service categories
          }
        }

        setServiceStandardTimes(standardTimes);
      } catch {
        // Silent fail - dashboard still works with default values
      }
    };

    loadServiceStandardTimes();
  }, []);

  // Fetch all users for transfer info display
  const { data: usersData } = useQuery({
    queryKey: ["all-users-for-tickets"],
    queryFn: () => apiFetch<ListUsersResponse>("/api/admin/users"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    usersData?.users.forEach((user) => {
      map.set(user.id, user.fullName || user.username);
    });
    return map;
  }, [usersData]);

  // Reset page to 1 when items change significantly
  useEffect(() => {
    setCurrentPage(1);
  }, [allItems.length]);

  const ITEMS_PER_PAGE = pageSize ?? 20;

  const total = allItems.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const items = allItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    }
  };

  const handlePrevPage = () => {
    if (hasPrevPage) {
      setCurrentPage((prev) => Math.max(prev - 1, 1));
    }
  };

  const handlePageClick = (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
  };

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No records available.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  userMap={userMap}
                  currentWindowId={currentWindowId}
                  serviceStandardTimes={serviceStandardTimes}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={!hasPrevPage}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageClick(page)}
                          className="h-9 w-9 p-0"
                          aria-current={
                            page === currentPage ? "page" : undefined
                          }
                        >
                          {page}
                        </Button>
                      ),
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!hasNextPage}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages} ({total} total records)
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TicketRow({
  ticket,
  userMap,
  currentWindowId,
  serviceStandardTimes = {},
}: {
  ticket: Ticket;
  userMap: Map<string, string>;
  currentWindowId?: number;
  serviceStandardTimes?: Record<string, number>;
}) {
  // Auto-expand completed tickets by default
  const [isExpanded, setIsExpanded] = useState(ticket.status === "done");

  // Fetch workflow data for completed tickets
  const { data: performanceData } = useQuery({
    queryKey: ["case-workflow-process", ticket.id],
    queryFn: async () => {
      const response = await apiFetch<CaseWorkflowResponse>(
        `/api/employee/case-workflow?ticketId=${encodeURIComponent(ticket.id)}`,
      );
      return response;
    },
    enabled: ticket.status === "done",
  });

  // Calculate total duration from workflow items
  const totalDuration = useMemo(() => {
    if (!performanceData?.items) return null;
    const items = performanceData.items;
    return items.reduce((sum, item) => sum + (item.durationSeconds || 0), 0);
  }, [performanceData]);

  // Helper function to format seconds
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

  // Get standard time for selected services
  const getSelectedServicesStandardTime = () => {
    const selectedServices = ticket.selectedServices || [];
    if (selectedServices.length === 0) {
      return 0;
    }

    const totalMinutes = selectedServices.reduce((sum, serviceName) => {
      const standardMinutes = serviceStandardTimes[serviceName] || 0;
      return sum + standardMinutes;
    }, 0);

    return totalMinutes;
  };

  // Check if duration exceeds standard time
  const getStandardTimeStatus = () => {
    if (!totalDuration) {
      return {
        exceeds: false,
        performanceLevel: "on_time" as const,
        standardMinutes: null,
        standardSeconds: null,
        source: null as "category" | "services" | null
      };
    }

    // First priority: check selected services
    const selectedServices = ticket.selectedServices || [];
    if (selectedServices.length > 0) {
      const totalMinutes = getSelectedServicesStandardTime();
      if (totalMinutes > 0) {
        const standardSeconds = totalMinutes * 60;
        let percentageOfStandard: number;
        // If Actual Work Time equals Standard Time, set percentage to 35%
        if (totalDuration === standardSeconds) {
          percentageOfStandard = 35;
        } else {
          percentageOfStandard = (totalDuration / standardSeconds) * 100;
        }

        let performanceLevel: "on_time" | "slightly_over" | "significantly_over";
        if (percentageOfStandard <= 100) {
          performanceLevel = "on_time";
        } else if (percentageOfStandard <= 120) {
          performanceLevel = "slightly_over";
        } else {
          performanceLevel = "significantly_over";
        }

        const exceeds = totalDuration > standardSeconds;
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
    const serviceCategory = ticket.service;
    if (serviceCategory) {
      const standardMinutes = serviceStandardTimes[serviceCategory];
      if (standardMinutes) {
        const standardSeconds = standardMinutes * 60;
        let percentageOfStandard: number;
        // If Actual Work Time equals Standard Time, set percentage to 35%
        if (totalDuration === standardSeconds) {
          percentageOfStandard = 35;
        } else {
          percentageOfStandard = (totalDuration / standardSeconds) * 100;
        }

        let performanceLevel: "on_time" | "slightly_over" | "significantly_over";
        if (percentageOfStandard <= 100) {
          performanceLevel = "on_time";
        } else if (percentageOfStandard <= 120) {
          performanceLevel = "slightly_over";
        } else {
          performanceLevel = "significantly_over";
        }

        const exceeds = totalDuration > standardSeconds;
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

  // Convert performance data to process steps
  const processSteps = useMemo(() => {
    // The API returns { items: [workflow steps] }
    // Each item contains the employee/archiver/teller workflow data
    const workflowItems = performanceData?.items;

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

    const steps = [];
    let stepNumber = 1;

    // Process all workflow items in order (including archiver, teller, and employee steps)
    if (workflowItems && workflowItems.length > 0) {
      workflowItems.forEach((item: any) => {
        // Determine the display name and status
        let displayName = item.employeeName || "Unknown";
        let displayStatus = item.status || "Started";

        // For archiver steps, use a descriptive label
        if (item.isArchiver) {
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
        let action: "Started" | "Proceeded" | "Completed" | "Serving" | "On Hold" = "Started";
        if (displayStatus === "Completed" || displayStatus === "completed") {
          action = "Completed";
        } else if (
          displayStatus === "Proceeded" ||
          displayStatus === "proceeded"
        ) {
          action = "Proceeded";
        } else if (displayStatus === "Serving" || displayStatus === "serving") {
          action = "Serving";
        } else if (displayStatus === "On Hold" || displayStatus === "on_hold") {
          action = "On Hold";
        } else if (
          displayStatus === "Retrieved" ||
          displayStatus === "retrieved"
        ) {
          // Treat Retrieved as Started for process flow
          action = "Started";
        }

        steps.push({
          id: item.id,
          number: stepNumber++,
          employeeName: item.employeeName || "Unknown",
          jobTitle: item.jobTitle,
          action: action,
          duration: formatTime(item.durationSeconds),
          durationSeconds: item.durationSeconds,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          windowId: item.windowId,
          isTeller: item.isTeller,
          isArchiver: item.isArchiver,
        });
      });
    }

    return steps;
  }, [performanceData]);

  const getWindowName = (windowId: number | null | undefined) => {
    if (!windowId) return "—";
    return `Window ${windowId}`;
  };

  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const extractReason = (remark: string | undefined) => {
    if (!remark) return null;
    // Extract the reason part if it exists (format: "... Reason: REASON_TEXT")
    const reasonMatch = remark.match(/Reason:\s*(.+)$/);
    if (reasonMatch) {
      return reasonMatch[1].trim();
    }
    return null;
  };

  const extractSkipReason = (remark: string | undefined) => {
    if (!remark) return null;
    // Extract the reason part if it exists (format: "Skipped by window X at ISO_TIME. Reason: REASON_TEXT")
    const reasonMatch = remark.match(/Reason:\s*(.+)$/);
    if (reasonMatch) {
      return reasonMatch[1].trim();
    }
    // If no explicit reason, extract just the window and time info
    const timeMatch = remark.match(/Skipped by window (\d+) at (.+?)(?:\.|$)/);
    if (timeMatch) {
      const window = timeMatch[1];
      const time = new Date(timeMatch[2]).toLocaleTimeString();
      return `Window ${window} at ${time}`;
    }
    return remark;
  };

  return (
    <>
      <div
        className={`rounded-lg border transition-all ${
          ticket.status === "done"
            ? "border-border bg-card"
            : "border-border/50 bg-background/50"
        }`}
      >
        {/* Accordion header - always visible */}
        <div className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-semibold text-foreground">{ticket.code}</p>
              <p className="text-sm text-muted-foreground">
                {ticket.ownerName || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {ticket.status === "done" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-8 w-8 p-0"
                  aria-label={
                    isExpanded
                      ? "Collapse ticket details"
                      : "Expand ticket details"
                  }
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              )}
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                  ticket.status === "done"
                    ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-100"
                    : ticket.status === "skipped"
                      ? "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-100"
                      : ticket.status === "serving"
                        ? "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                        : "bg-gray-200 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
                }`}
              >
                {ticket.status}
              </span>
            </div>
          </div>
        </div>

        {/* Accordion content - shown when expanded */}
        {isExpanded && (
          <div className="border-t border-current/10 px-3 pb-3 pt-3 space-y-3">
            {(ticket.transferredFromWindow ||
              ticket.transferredToWindow ||
              ticket.transferredToUserId) && (
              <div className="rounded bg-purple-50/50 p-2 dark:bg-purple-950/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                    Transfer Info
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground font-medium">
                    {ticket.transferredFromWindow
                      ? getWindowName(ticket.transferredFromWindow)
                      : "—"}
                  </span>
                  <ArrowRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-muted-foreground font-medium">
                    {ticket.transferredToWindow
                      ? getWindowName(ticket.transferredToWindow)
                      : ticket.transferredToUserId
                        ? userMap.get(ticket.transferredToUserId) || "—"
                        : "—"}
                  </span>
                </div>
                {ticket.transferredAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(ticket.transferredAt)}</span>
                  </div>
                )}
                {ticket.remark && extractReason(ticket.remark) && (
                  <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                      Transfer Reason
                    </p>
                    <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                      {extractReason(ticket.remark)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {ticket.selectedServices && ticket.selectedServices.length > 0 && (
              <div className="rounded bg-blue-50/50 p-2 dark:bg-blue-950/20">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Selected Services
                </p>
                <ul className="mt-1 space-y-1">
                  {ticket.selectedServices.map((serviceName, index) => (
                    <li
                      key={index}
                      className="text-xs text-blue-600 dark:text-blue-400"
                    >
                      • {serviceName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ticket.notes && (
              <p className="text-sm text-muted-foreground">
                Notes: {ticket.notes}
              </p>
            )}
            {ticket.status === "skipped" && ticket.remark && (
              <div className="rounded bg-red-50/50 p-2 dark:bg-red-950/20">
                <p className="text-xs font-medium text-red-700 dark:text-red-300">
                  Skip Reason
                </p>
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {extractSkipReason(ticket.remark) || "No reason provided"}
                </p>
              </div>
            )}
            {ticket.woreda && (
              <p className="text-xs text-muted-foreground">
                Woreda: {ticket.woreda}
              </p>
            )}

            {/* Process flow chart for completed tickets */}
            {ticket.status === "done" && (
              <>
                {processSteps.length > 0 ? (
                  <ProcessFlowChart
                    ticket={ticket}
                    steps={processSteps}
                    userMap={userMap}
                  />
                ) : (
                  <CompletedTicketSummary ticket={ticket} />
                )}

                {/* Performance Rating Slider */}
                {(() => {
                  const { performanceLevel, standardMinutes, standardSeconds, source } =
                    getStandardTimeStatus();
                  const selectedServices = ticket.selectedServices || [];

                  if (standardSeconds && totalDuration) {
                    let percentageOfStandard: number;
                    // If Actual Work Time equals Standard Time, set percentage to 35%
                    if (totalDuration === standardSeconds) {
                      percentageOfStandard = 35;
                    } else {
                      percentageOfStandard = Math.round(
                        (totalDuration / standardSeconds) * 100
                      );
                    }

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
                              totalDuration - standardSeconds
                            )} (${percentageOfStandard - 100}%)`,
                            color: "text-yellow-600 dark:text-yellow-400"
                          };
                        case "significantly_over":
                          return {
                            text: `Significantly over by ${formatSeconds(
                              totalDuration - standardSeconds
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
                              <div className="flex-1 relative h-4 rounded-full shadow-sm overflow-hidden">
                                <div
                                  className="absolute inset-0 rounded-full"
                                  style={{
                                    background: "linear-gradient(to right, rgb(34, 197, 94), rgb(251, 191, 36), rgb(251, 146, 60), rgb(239, 68, 68))"
                                  }}
                                ></div>

                                <div
                                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-800 dark:bg-slate-200 rounded-full shadow-lg border-2 border-white dark:border-slate-900 transition-all"
                                  style={{
                                    left: `calc(${Math.min(
                                      (totalDuration / standardSeconds) * 100,
                                      100
                                    )}% - 8px)`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-sm font-bold whitespace-nowrap min-w-fit">
                                {Math.min(percentageOfStandard, 100)}%
                              </span>
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

                  return null;
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

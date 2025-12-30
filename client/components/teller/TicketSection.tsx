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
} from "lucide-react";
import { CaseWorkflowTimeline } from "./CaseWorkflowTimeline";

interface TicketSectionProps {
  items: Ticket[];
  title: string;
  pageSize?: number;
}

export function TicketSection({
  items: allItems,
  title,
  pageSize,
}: TicketSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);

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
                <TicketRow key={ticket.id} ticket={ticket} />
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

function TicketRow({ ticket }: { ticket: Ticket }) {
  const [isExpanded, setIsExpanded] = useState(false);

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
      <div className="rounded-lg border border-border/50 bg-background/50 p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-foreground">{ticket.code}</p>
            <p className="text-sm text-muted-foreground">
              {ticket.ownerName || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {ticket.status === "done" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0"
                aria-label={
                  isExpanded ? "Collapse workflow" : "Expand workflow"
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
              className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                ticket.status === "done"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  : ticket.status === "skipped"
                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                    : ticket.status === "serving"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                      : ticket.status === "transferred"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
              }`}
            >
              {ticket.status}
            </span>
          </div>
        </div>

        {ticket.status === "transferred" && (
          <div className="mt-3 rounded bg-purple-50/50 p-2 dark:bg-purple-950/20">
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
          <div className="mt-2 rounded bg-blue-50/50 p-2 dark:bg-blue-950/20">
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
          <p className="mt-2 text-sm text-muted-foreground">
            Notes: {ticket.notes}
          </p>
        )}
        {ticket.status === "skipped" && ticket.remark && (
          <div className="mt-2 rounded bg-red-50/50 p-2 dark:bg-red-950/20">
            <p className="text-xs font-medium text-red-700 dark:text-red-300">
              Skip Reason
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {extractSkipReason(ticket.remark) || "No reason provided"}
            </p>
          </div>
        )}
        {ticket.woreda && (
          <p className="mt-1 text-xs text-muted-foreground">
            Woreda: {ticket.woreda}
          </p>
        )}
      </div>

      {ticket.status === "done" && isExpanded && (
        <CaseWorkflowTimeline ticket={ticket} />
      )}
    </>
  );
}

import { useEffect, useState, useMemo, useRef } from "react";
import { useSessionWebSocket } from "@/hooks/useSessionWebSocket";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, Trash2, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";
import type { SessionSummary } from "@shared/api";

const ITEMS_PER_PAGE = 10;

export default function SessionManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const accordionRef = useRef<HTMLDivElement>(null);

  const { sessions, isConnected, error, isLoading } = useSessionWebSocket();

  const userSessionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sessions.forEach((session) => {
      if (session.status === "active") {
        counts.set(
          session.username,
          (counts.get(session.username) || 0) + 1
        );
      }
    });
    return counts;
  }, [sessions]);

  const paginationData = useMemo(() => {
    // Group sessions by username to show unique users only (only active sessions)
    const userMap = new Map<string, SessionSummary[]>();
    sessions.forEach((session) => {
      if (session.status === "active") {
        if (!userMap.has(session.username)) {
          userMap.set(session.username, []);
        }
        userMap.get(session.username)!.push(session);
      }
    });

    // Get unique users (most recent session per user)
    const uniqueUsers = Array.from(userMap.values()).map((userSessions) => {
      // Return the most recent session for this user
      return userSessions.reduce((latest, current) =>
        current.lastSeenAt > latest.lastSeenAt ? current : latest
      );
    });

    const totalPages = Math.ceil(uniqueUsers.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const currentSessions = uniqueUsers.slice(startIdx, endIdx);

    return {
      currentSessions,
      totalPages,
      totalItems: uniqueUsers.length,
      startIdx,
      endIdx,
      userSessionMap: userMap,
    };
  }, [sessions, currentPage]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "revoked":
        return "bg-red-100 text-red-800";
      case "expired":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "login";
      case "revoked":
        return "logout";
      case "expired":
        return "expired";
      default:
        return status;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "reception":
        return "bg-blue-100 text-blue-800";
      case "teller":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return "✓";
      case "revoked":
        return "✕";
      case "expired":
        return "⏱";
      default:
        return "•";
    }
  };

  const getStatusDescription = (status: string): string => {
    switch (status) {
      case "active":
        return "User is logged in";
      case "revoked":
        return "User has logged out (or admin terminated / security event)";
      case "expired":
        return "Session exceeded maximum lifetime";
      default:
        return "Unknown session status";
    }
  };

  const formatTime = (timestamp: number | null | undefined) => {
    if (!timestamp || typeof timestamp !== 'number') return "—";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "—";
    return format(date, "MMM d, HH:mm");
  };

  const formatDuration = (start: number, end: number) => {
    const diff = (end - start) / 1000;
    if (diff < 60) return `${Math.round(diff)}s`;
    if (diff < 3600) return `${Math.round(diff / 60)}m`;
    return `${Math.round(diff / 3600)}h`;
  };

  const handleAccordionChange = (value: string) => {
    // Scroll into view with smooth behavior when accordion expands
    setTimeout(() => {
      const element = document.getElementById(`accordion-${value}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to revoke this session?")) {
      return;
    }

    setRevoking((prev) => new Set(prev).add(sessionId));
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data?.error || `Failed to revoke session (${response.status})`
        );
      }

      setRevokeSuccess(`Session revoked successfully`);
      setTimeout(() => setRevokeSuccess(null), 3000);

      // WebSocket will automatically update sessions
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Note: error state would need to be added if we want to display revoke errors
      console.error(`Failed to revoke session: ${errMsg}`);
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            <p className="ml-4 text-muted-foreground">Loading sessions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>
                  Monitor logged-in users ({paginationData.totalItems} users, {sessions.length} sessions)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isConnected && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                    Live
                  </span>
                )}
                {!isConnected && (
                  <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></span>
                    Polling
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {revokeSuccess && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-800">
              {revokeSuccess}
            </AlertDescription>
          </Alert>
        )}

        {paginationData.totalItems === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No active sessions
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-0">
                <Accordion type="single" collapsible onValueChange={handleAccordionChange}>
                  {paginationData.currentSessions.map((userSession) => {
                    const allUserSessions = paginationData.userSessionMap?.get(userSession.username) || [userSession];
                    return (
                      <div key={userSession.username} id={`accordion-${userSession.username}`}>
                        <AccordionItem value={userSession.username}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex w-full items-center justify-between gap-4 py-2">
                            <div className="flex flex-1 items-center gap-4">
                              <div className="flex flex-col text-left">
                                <span className="font-medium">
                                  {userSession.fullName || userSession.username}
                                </span>
                                {userSession.jobTitle && (
                                  <span className="text-xs text-muted-foreground">
                                    {userSession.jobTitle}
                                  </span>
                                )}
                              </div>
                              <Badge className={getRoleColor(userSession.role)}>
                                {userSession.role}
                              </Badge>
                              <Badge variant="outline">
                                {allUserSessions.length} device{allUserSessions.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  className={getStatusColor(userSession.status)}
                                >
                                  {getStatusIcon(userSession.status)}{" "}
                                  {getStatusLabel(userSession.status)}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {getStatusDescription(userSession.status)}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="overflow-x-auto mt-4 max-h-96 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Window</TableHead>
                                  <TableHead>Device</TableHead>
                                  <TableHead>Browser</TableHead>
                                  <TableHead>OS</TableHead>
                                  <TableHead>IP Address</TableHead>
                                  <TableHead>Logged In</TableHead>
                                  <TableHead>Last Seen</TableHead>
                                  <TableHead>Duration</TableHead>
                                  <TableHead>Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {allUserSessions.map((session) => (
                                  <TableRow key={session.id}>
                                    <TableCell>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge
                                            className={getStatusColor(session.status)}
                                          >
                                            {getStatusIcon(session.status)}{" "}
                                            {getStatusLabel(session.status)}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {getStatusDescription(session.status)}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {session.windowId ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[120px] truncate">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help">
                                            {session.device || "Desktop"}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-xs">
                                            <div>{session.device || "Desktop"}</div>
                                            {session.deviceVendor && (
                                              <div className="text-muted-foreground">
                                                Vendor: {session.deviceVendor}
                                              </div>
                                            )}
                                            {session.deviceModel && (
                                              <div className="text-muted-foreground">
                                                Model: {session.deviceModel}
                                              </div>
                                            )}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[120px] truncate">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help">
                                            {session.browserName || session.browser || "—"}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-xs">
                                            <div>{session.browserName || session.browser || "Unknown"}</div>
                                            {session.browserVersion && (
                                              <div className="text-muted-foreground">
                                                v{session.browserVersion}
                                              </div>
                                            )}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[100px] truncate">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help">
                                            {session.osName || session.os || "—"}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-xs">
                                            <div>{session.osName || session.os || "Unknown"}</div>
                                            {session.osVersion && (
                                              <div className="text-muted-foreground">
                                                {session.osVersion}
                                              </div>
                                            )}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {session.ipAddress || "—"}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {formatTime(session.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {formatTime(session.lastSeenAt)}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {formatDuration(
                                        session.createdAt,
                                        session.lastSeenAt,
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {session.status === "active" ? (
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => handleRevokeSession(session.id)}
                                          disabled={revoking.has(session.id)}
                                        >
                                          {revoking.has(session.id) ? (
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                          ) : (
                                            "Terminate"
                                          )}
                                        </Button>
                                      ) : null}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      </div>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>

            {/* Pagination */}
            {paginationData.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold">
                    {paginationData.startIdx + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold">
                    {Math.min(paginationData.endIdx, paginationData.totalItems)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold">
                    {paginationData.totalItems}
                  </span>{" "}
                  sessions
                </div>

                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage((p) => Math.max(1, p - 1));
                        }}
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>

                    {(() => {
                      const pages: (number | string)[] = [];
                      const totalPages = paginationData.totalPages;
                      const current = currentPage;
                      const maxVisible = 5;

                      // Always show first page
                      pages.push(1);

                      // Add ellipsis and pages before current
                      if (current > maxVisible) {
                        pages.push("...");
                      }

                      // Show pages around current (current - 2 to current + 2)
                      const rangeStart = Math.max(2, current - 1);
                      const rangeEnd = Math.min(totalPages - 1, current + 1);

                      for (let i = rangeStart; i <= rangeEnd; i++) {
                        if (!pages.includes(i)) {
                          pages.push(i);
                        }
                      }

                      // Add ellipsis and pages after current
                      if (current < totalPages - (maxVisible - 1)) {
                        pages.push("...");
                      }

                      // Always show last page if more than 1 page
                      if (totalPages > 1 && !pages.includes(totalPages)) {
                        pages.push(totalPages);
                      }

                      // Remove duplicates
                      const uniquePages = [...new Set(pages)];

                      return uniquePages.map((page, idx) =>
                        page === "..." ? (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === page}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page as number);
                              }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      );
                    })()}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage((p) =>
                            Math.min(paginationData.totalPages, p + 1),
                          );
                        }}
                        className={
                          currentPage === paginationData.totalPages
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

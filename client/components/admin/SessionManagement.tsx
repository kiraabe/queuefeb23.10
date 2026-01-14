import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { AlertCircle, RefreshCw } from "lucide-react";
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
import type { ListSessionsResponse, SessionSummary } from "@shared/api";

const ITEMS_PER_PAGE = 10;

export default function SessionManagement() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, refetch, error: queryError } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      try {
        console.log("[SessionManagement] Fetching sessions from /api/admin/sessions");
        const response = await fetch("/api/admin/sessions", {
          method: "GET",
          credentials: "include",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/json",
          },
        });

        console.log("[SessionManagement] Response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to fetch sessions:", response.status, response.statusText);
          console.error("Response body:", errorText);

          // If 401/403, it's an auth error
          if (response.status === 401 || response.status === 403) {
            throw new Error(`Authentication failed: ${response.status} ${response.statusText}. Make sure you are logged in as an admin.`);
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as ListSessionsResponse;
        console.log("[SessionManagement] Sessions loaded, count:", data.sessions?.length || 0);
        return data;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[SessionManagement] Fetch error:", errMsg);
        throw new Error(errMsg);
      }
    },
    refetchInterval: 5000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  useEffect(() => {
    if (data?.sessions) {
      setSessions(data.sessions);
      setError(null);
      setCurrentPage(1);
    }
  }, [data]);

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const currentSessions = sessions.slice(startIdx, endIdx);

    return {
      currentSessions,
      totalPages,
      totalItems: sessions.length,
      startIdx,
      endIdx,
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

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp), "MMM d, HH:mm");
  };

  const formatDuration = (start: number, end: number) => {
    const diff = (end - start) / 1000;
    if (diff < 60) return `${Math.round(diff)}s`;
    if (diff < 3600) return `${Math.round(diff / 60)}m`;
    return `${Math.round(diff / 3600)}h`;
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Monitor user sessions across the system ({sessions.length})
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : String(error)}
          </AlertDescription>
        </Alert>
      )}

      {queryError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Query Error: {queryError instanceof Error ? queryError.message : String(queryError)}
          </AlertDescription>
        </Alert>
      )}

      {sessions.length === 0 ? (
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Logged In</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginationData.currentSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          {session.username}
                        </TableCell>
                        <TableCell>
                          <Badge className={getRoleColor(session.role)}>
                            {session.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(session.status)}>
                            {getStatusIcon(session.status)} {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {session.windowId ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatTime(session.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatTime(session.lastSeenAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDuration(session.createdAt, session.lastSeenAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                  {Math.min(
                    paginationData.endIdx,
                    paginationData.totalItems,
                  )}
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
                        currentPage === 1 ? "pointer-events-none opacity-50" : ""
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
  );
}

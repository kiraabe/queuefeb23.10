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
  AlertCircle,
  RefreshCw,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import type { ListSessionsResponse, SessionSummary } from "@shared/api";

const ITEMS_PER_PAGE = 6;

export default function SessionManagement() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const response = await fetch("/api/admin/sessions", {
        credentials: "include",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!response.ok) throw new Error("Failed to fetch sessions");
      return (await response.json()) as ListSessionsResponse;
    },
    refetchInterval: 5000,
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

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp), "MMM d, HH:mm:ss");
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
          <p className="text-center text-muted-foreground">
            Loading sessions...
          </p>
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
                Monitor and manage user sessions across the system
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
          <AlertDescription>{error}</AlertDescription>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginationData.currentSessions.map((session) => (
              <Card key={session.id} className="flex flex-col">
                <CardContent className="flex-1 pt-6">
                  <div className="space-y-3">
                    {/* Session Header */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold truncate">
                          {session.username}
                        </p>
                        <Badge className={getStatusColor(session.status)}>
                          {session.status === "active" && "✓"}
                          {session.status === "revoked" && "✕"}
                          {session.status === "expired" && "⏱"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">
                          {session.id}
                        </p>
                        <Badge
                          className={getRoleColor(session.role)}
                          variant="secondary"
                        >
                          {session.role}
                        </Badge>
                      </div>
                    </div>

                    {/* Session Details Grid */}
                    <div className="space-y-2 border-t pt-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Window</p>
                          <p className="font-medium">
                            {session.windowId ?? "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-medium">
                            {formatDuration(
                              session.createdAt,
                              session.lastSeenAt,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Logged In
                        </p>
                        <p className="font-medium text-xs">
                          {formatTime(session.createdAt)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Last Seen
                        </p>
                        <p className="font-medium text-xs">
                          {formatTime(session.lastSeenAt)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Expires</p>
                        <p className="font-medium text-xs">
                          {formatTime(session.expiresAt)}
                        </p>
                      </div>

                      {session.revokeReason && (
                        <div className="mt-2 rounded-sm bg-red-50 p-2">
                          <p className="text-xs text-red-700">
                            <span className="font-semibold">Revoked:</span>{" "}
                            {session.revokeReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>

                {/* Actions */}
                {session.status === "active" && (
                  <div className="border-t p-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled
                      className="w-full"
                    >
                      <LogOut className="mr-2 h-3 w-3" />
                      Revoke (Coming Soon)
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {paginationData.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border bg-card p-4">
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

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {(() => {
                    const pages: (number | string)[] = [];
                    const totalPages = paginationData.totalPages;
                    const current = currentPage;
                    const maxVisible = 5;

                    // Always show first 3 pages
                    for (let i = 1; i <= Math.min(3, totalPages); i++) {
                      pages.push(i);
                    }

                    // Add ellipsis if needed
                    if (current > 4) {
                      if (pages[pages.length - 1] !== "...") pages.push("...");
                    }

                    // Show current page and adjacent pages
                    for (
                      let i = Math.max(4, current - 1);
                      i <= Math.min(current + 1, totalPages - 3);
                      i++
                    ) {
                      if (!pages.includes(i)) pages.push(i);
                    }

                    // Add ellipsis before last pages if needed
                    if (current < totalPages - 3) {
                      if (pages[pages.length - 1] !== "...") pages.push("...");
                    }

                    // Always show last 3 pages
                    for (
                      let i = Math.max(totalPages - 2, 1);
                      i <= totalPages;
                      i++
                    ) {
                      if (!pages.includes(i)) pages.push(i);
                    }

                    // Remove duplicates
                    return [...new Set(pages)].map((page, idx) =>
                      page === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-1">
                          ...
                        </span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page as number)}
                          className="min-w-9"
                        >
                          {page}
                        </Button>
                      ),
                    );
                  })()}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(paginationData.totalPages, p + 1),
                    )
                  }
                  disabled={currentPage === paginationData.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(paginationData.totalPages)}
                  disabled={currentPage === paginationData.totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor("active")}>✓ Active</Badge>
              <span className="text-muted-foreground">
                User is currently logged in
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor("revoked")}>✕ Revoked</Badge>
              <span className="text-muted-foreground">
                Session was revoked by admin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor("expired")}>⏱ Expired</Badge>
              <span className="text-muted-foreground">Session has expired</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

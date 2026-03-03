import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  Archive,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";

interface ArchivedTicket {
  id: string;
  code: string;
  service: string;
  number: number;
  ownerName: string;
  serviceCategory: string;
  createdAt: number;
  archiverStartedAt: number | null;
  retrievedAt: number | null;
  manuallyArchivedAt: number | null;
  processingTime: number | null; // minutes
}

export function ArchivedTicketsHistory() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [archivedTickets, setArchivedTickets] = useState<Set<string>>(
    new Set(),
  );
  const [archivingTicket, setArchivingTicket] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Fetch archived history
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["archiever-history"],
    queryFn: async () => {
      const response = await fetch("/api/archiever/history");
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json() as Promise<{ tickets: ArchivedTicket[] }>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const tickets = data?.tickets ?? [];

  // Helper function to check if ticket is from today
  const isToday = (timestamp: number | null) => {
    if (!timestamp) return false;
    const ticketDate = new Date(timestamp);
    const today = new Date();
    return ticketDate.toDateString() === today.toDateString();
  };

  // Helper function to check if ticket is from this week
  const isThisWeek = (timestamp: number | null) => {
    if (!timestamp) return false;
    const ticketDate = new Date(timestamp);
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return ticketDate >= weekStart && ticketDate < weekEnd;
  };

  // Filter tickets based on search term and time filter
  const filteredTickets = tickets.filter((ticket) => {
    // Apply search filter
    const matchesSearch =
      ticket.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.service.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Apply time filter
    if (timeFilter === "today") {
      return isToday(ticket.retrievedAt);
    } else if (timeFilter === "week") {
      return isThisWeek(ticket.retrievedAt);
    }

    return true; // "all" filter shows all tickets
  });

  // Reset to first page when search term or time filter changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleTimeFilterChange = (filter: "all" | "today" | "week") => {
    setTimeFilter(filter);
    setCurrentPage(1);
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  // Calculate stats - only include tickets with both start and retrieved timestamps
  const validTickets = tickets.filter(
    (t) => t.archiverStartedAt && t.retrievedAt && t.processingTime !== null,
  );
  const stats = {
    total: tickets.length,
    today: tickets.filter((t) => {
      const today = new Date();
      const retrieved = t.retrievedAt ? new Date(t.retrievedAt) : null;
      return retrieved && retrieved.toDateString() === today.toDateString();
    }).length,
    avgTime:
      validTickets.length > 0
        ? validTickets.reduce((sum, t) => sum + (t.processingTime || 0), 0) /
          validTickets.length
        : null,
  };

  const handleBackToArchive = async (ticketId: string, ticketCode: string) => {
    setArchivingTicket(ticketId);
    try {
      const response = await fetch(
        `/api/archiever/tickets/${ticketId}/manually-archive`,
        {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Failed to archive ticket";
        throw new Error(errorMessage);
      }
      setArchivedTickets((prev) => new Set(prev).add(ticketId));
      toast.success(`Ticket ${ticketCode} marked as archived`);
      refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to archive ticket";
      console.error("Error archiving ticket:", message);
      toast.error(message);
    } finally {
      setArchivingTicket(null);
    }
  };

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return "N/A";

    // Less than 1 minute - show in seconds
    if (minutes < 1) {
      const seconds = Math.round(minutes * 60);
      return `${seconds}s`;
    }

    // Less than 60 minutes - show in minutes
    if (minutes < 60) {
      return `${minutes.toFixed(1)}m`;
    }

    // 60 minutes or more - show in hours and minutes
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  const formatTime24Hour = (timestamp: number | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDateAndTime = (timestamp: number | null) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} ${timeStr}`;
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("archiever.history.totalRetrieved")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.total}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("archiever.history.ticketsProcessed")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("archiever.history.retrievedToday")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.today}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("archiever.history.completedOps")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("archiever.history.avgTime")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {formatTime(stats.avgTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("archiever.history.avgTimeDesc")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("archiever.history.title")}</CardTitle>
              <CardDescription>
                {t("archiever.history.description")}
              </CardDescription>
            </div>
            <Badge variant="outline">{filteredTickets.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Input
              placeholder={t("archiever.history.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="max-w-md"
            />

            {/* Time Filter Buttons */}
            <div className="flex gap-2">
              <Button
                variant={timeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimeFilterChange("all")}
              >
                {t("archiever.history.all")}
              </Button>
              <Button
                variant={timeFilter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimeFilterChange("today")}
              >
                {t("archiever.history.today")}
              </Button>
              <Button
                variant={timeFilter === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimeFilterChange("week")}
              >
                {t("archiever.history.week")}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("archiever.history.errors.loadFailed")}
              </AlertDescription>
            </Alert>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">{t("archiever.history.empty")}</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? t("archiever.history.emptySearch")
                  : t("archiever.history.emptyDesc")}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedTickets.map((ticket) => {
                  const isArchived =
                    archivedTickets.has(ticket.id) ||
                    !!ticket.manuallyArchivedAt;

                  return (
                    <div
                      key={ticket.id}
                      className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      {/* Main content grid */}
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start md:items-center mb-3 md:mb-0">
                        {/* Ticket Code */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("archiever.history.details")}
                          </p>
                          <div className="flex flex-col gap-1">
                            <p className="text-lg font-bold text-blue-600">
                              {ticket.code}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {ticket.ownerName || t("common.na")}
                            </p>
                          </div>
                        </div>

                        {/* Service Category */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("archiever.workspace.serviceCategory")}
                          </p>
                          <p className="font-medium text-sm">
                            {ticket.serviceCategory || t("common.na")}
                          </p>
                        </div>

                        {/* Start Time */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("archiever.history.startTime")}
                          </p>
                          <p className="text-sm">
                            {formatDateAndTime(ticket.archiverStartedAt)}
                          </p>
                        </div>

                        {/* Retrieved Time */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("archiever.history.retrievedTime")}
                          </p>
                          <p className="text-sm">
                            {formatDateAndTime(ticket.retrievedAt)}
                          </p>
                        </div>

                        {/* Duration */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("archiever.history.duration")}
                          </p>
                          <p className="text-sm font-medium">
                            {formatTime(ticket.processingTime)}
                          </p>
                        </div>

                        {/* Back To Archive Button & Archived Timestamp */}
                        <div className="flex flex-col gap-2 pt-2 md:pt-0">
                          {isArchived ? (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="w-full"
                              >
                                <Check className="h-4 w-4 mr-2" />
                                {t("archiever.history.archived")}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleBackToArchive(ticket.id, ticket.code)
                              }
                              disabled={archivingTicket === ticket.id}
                              className="w-full"
                            >
                              {archivingTicket === ticket.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  {t("archiever.history.archiving")}
                                </>
                              ) : (
                                <>
                                  <Archive className="h-4 w-4 mr-2" />
                                  {t("archiever.history.backBtn")}
                                </>
                              )}
                            </Button>
                          )}
                          {ticket.manuallyArchivedAt && (
                            <p className="text-xs text-muted-foreground">
                              {formatDate(ticket.manuallyArchivedAt)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Processing Time - shown below on mobile */}
                      <div className="md:hidden mt-3 pt-3 border-t flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t("archiever.workspace.processingTime")}
                          </p>
                          <p className="font-semibold text-sm">
                            {formatTime(ticket.processingTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                    {t("archiever.history.pagingInfo", {
                      start: startIndex + 1,
                      end: Math.min(endIndex, filteredTickets.length),
                      total: filteredTickets.length,
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("common.previous")}
                    </Button>
                    <div className="text-sm font-medium">
                      {t("archiever.history.pageInfo", {
                        current: currentPage,
                        total: totalPages,
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      {t("common.next")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

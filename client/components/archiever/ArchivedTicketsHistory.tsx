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
  const [searchTerm, setSearchTerm] = useState("");
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

  // Filter tickets based on search term
  const filteredTickets = tickets.filter(
    (ticket) =>
      ticket.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.service.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Reset to first page when search term changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
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
        ? Math.round(
            validTickets.reduce((sum, t) => sum + (t.processingTime || 0), 0) /
              validTickets.length,
          )
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
      const message = error instanceof Error ? error.message : "Failed to archive ticket";
      console.error("Error archiving ticket:", message);
      toast.error(message);
    } finally {
      setArchivingTicket(null);
    }
  };

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return "N/A";
    if (minutes < 60) return `${minutes.toFixed(1)}m`;
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

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Retrieved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.total}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tickets processed by archivers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Retrieved Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.today}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Completed retrieval operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Processing Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {formatTime(stats.avgTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average time per ticket
            </p>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Archived Tickets</CardTitle>
              <CardDescription>
                Read-only history of retrieved tickets
              </CardDescription>
            </div>
            <Badge variant="outline">{filteredTickets.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by ticket code, customer name, or service..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="max-w-md"
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load archived history. Please try again.
              </AlertDescription>
            </Alert>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No archived tickets</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? "No tickets match your search"
                  : "Tickets retrieved by archivers will appear here"}
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
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start md:items-center mb-3 md:mb-0">
                        {/* Ticket Code */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Ticket Details
                          </p>
                          <div className="flex flex-col gap-1">
                            <p className="text-lg font-bold text-blue-600">
                              {ticket.code}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {ticket.ownerName || "N/A"}
                            </p>
                          </div>
                        </div>

                        {/* Service Category */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Service Category
                          </p>
                          <p className="font-medium text-sm">
                            {ticket.serviceCategory || "N/A"}
                          </p>
                        </div>

                        {/* Start Time */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Start Time
                          </p>
                          <p className="text-sm">
                            {formatTime24Hour(ticket.archiverStartedAt)}
                          </p>
                        </div>

                        {/* Retrieved Time */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Retrieved Time
                          </p>
                          <p className="text-sm">
                            {formatTime24Hour(ticket.retrievedAt)}
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
                                Archived
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
                                  Archiving...
                                </>
                              ) : (
                                <>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Back To Archive
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
                            Processing Time
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
                    Showing {startIndex + 1} to{" "}
                    {Math.min(endIndex, filteredTickets.length)} of{" "}
                    {filteredTickets.length} tickets
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="text-sm font-medium">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
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

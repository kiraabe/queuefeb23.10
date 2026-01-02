import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, Archive, Clock, ChevronLeft, ChevronRight } from "lucide-react";
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

interface ArchivedTicket {
  id: string;
  code: string;
  service: string;
  number: number;
  ownerName: string;
  serviceCategory: string;
  createdAt: number;
  archiverStartedAt: number;
  retrievedAt: number;
  processingTime: number | null; // minutes
}

export function ArchivedTicketsHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch archived history
  const { data, isLoading, error } = useQuery({
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

  const stats = {
    total: tickets.length,
    today: tickets.filter((t) => {
      const today = new Date();
      const retrieved = new Date(t.retrievedAt);
      return retrieved.toDateString() === today.toDateString();
    }).length,
    avgTime:
      tickets.length > 0
        ? Math.round(
            tickets.reduce((sum, t) => sum + (t.processingTime || 0), 0) /
              tickets.filter((t) => t.processingTime).length,
          )
        : 0,
  };

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return "N/A";
    if (minutes < 1) return "< 1m";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
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
              {formatTime(stats.avgTime === 0 ? null : stats.avgTime)}
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
            onChange={(e) => setSearchTerm(e.target.value)}
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
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Ticket Code
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        {ticket.code}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="font-medium">{ticket.ownerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Service</p>
                      <p className="font-medium text-sm">{ticket.service}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Retrieved Time
                      </p>
                      <p className="text-sm">
                        {new Date(ticket.retrievedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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

                  {/* Timestamp on separate row for mobile */}
                  <div className="md:hidden mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <p>Retrieved: {formatDate(ticket.retrievedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

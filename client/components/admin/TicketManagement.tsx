import { useState, useMemo } from "react";
import { useSSE } from "@/hooks/use-sse";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Search,
  Filter,
  DownloadCloud,
  CheckCircle,
  SkipForward,
  Clock,
  ArrowRightLeft,
} from "lucide-react";
import { format } from "date-fns";
import type { QueueSnapshot, Ticket } from "@shared/api";

export default function TicketManagement() {
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [searchCode, setSearchCode] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useSSE("/api/events", (event) => {
    if (event.type === "init") {
      const snapshot = event.payload as QueueSnapshot;
      setTickets(snapshot.tickets);
    } else if (
      event.type === "ticket.created" ||
      event.type === "ticket.updated"
    ) {
      const ticket = event.payload as Ticket;
      setTickets((prev) => ({ ...prev, [ticket.id]: ticket }));
    }
  });

  const ticketList = Object.values(tickets);
  const today = new Date().toDateString();

  const filteredTickets = useMemo(() => {
    let filtered = ticketList.filter((t) => {
      const ticketDate = new Date(t.createdAt).toDateString();
      return ticketDate === today;
    });

    if (searchCode) {
      filtered = filtered.filter((t) =>
        t.code.includes(searchCode.toUpperCase()),
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((t) => t.status === filterStatus);
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [ticketList, searchCode, filterStatus]);

  const statusCounts = useMemo(() => {
    return {
      all: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today;
      }).length,
      waiting: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "waiting";
      }).length,
      serving: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "serving";
      }).length,
      done: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "done";
      }).length,
      skipped: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "skipped";
      }).length,
      transferred: ticketList.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today && t.status === "transferred";
      }).length,
    };
  }, [ticketList]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-yellow-100 text-yellow-800";
      case "serving":
        return "bg-blue-100 text-blue-800";
      case "done":
        return "bg-green-100 text-green-800";
      case "skipped":
        return "bg-red-100 text-red-800";
      case "transferred":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle className="h-4 w-4" />;
      case "skipped":
        return <SkipForward className="h-4 w-4" />;
      case "serving":
        return <Clock className="h-4 w-4" />;
      case "transferred":
        return <ArrowRightLeft className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp), "HH:mm:ss");
  };

  const downloadCSV = () => {
    const headers = [
      "Code",
      "Status",
      "Service",
      "Selected Services",
      "Window ID",
      "Customer Name",
      "Woreda",
      "Created At",
      "Started At",
      "Completed At",
      "Notes",
    ];

    const rows = filteredTickets.map((t) => [
      t.code,
      t.status,
      t.service,
      t.selectedServices?.join("; ") || "",
      t.windowId || "",
      t.ownerName || "",
      t.woreda || "",
      format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss"),
      t.startedAt ? format(new Date(t.startedAt), "yyyy-MM-dd HH:mm:ss") : "",
      t.completedAt
        ? format(new Date(t.completedAt), "yyyy-MM-dd HH:mm:ss")
        : "",
      t.notes || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickets-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <CardTitle>Ticket Management</CardTitle>
                <CardDescription>
                  View and manage all tickets issued today
                </CardDescription>
              </div>
              <Button onClick={downloadCSV} variant="outline" size="sm">
                <DownloadCloud className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by ticket code..."
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Status Tabs */}
      <Tabs
        value={filterStatus}
        onValueChange={setFilterStatus}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="waiting">
            <Clock className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Waiting</span>
            <span className="sm:hidden">({statusCounts.waiting})</span>
          </TabsTrigger>
          <TabsTrigger value="serving">
            <Clock className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Serving</span>
            <span className="sm:hidden">({statusCounts.serving})</span>
          </TabsTrigger>
          <TabsTrigger value="done">
            <CheckCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Done</span>
            <span className="sm:hidden">({statusCounts.done})</span>
          </TabsTrigger>
          <TabsTrigger value="skipped">
            <SkipForward className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Skipped</span>
            <span className="sm:hidden">({statusCounts.skipped})</span>
          </TabsTrigger>
          <TabsTrigger value="transferred">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Transferred</span>
            <span className="sm:hidden">({statusCounts.transferred})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filterStatus} className="space-y-4">
          {filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {searchCode
                    ? "No tickets match your search"
                    : "No tickets found"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {filteredTickets.map((ticket) => (
                <Card key={ticket.id} className="overflow-hidden">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <p className="text-2xl font-bold text-blue-600">
                            {ticket.code}
                          </p>
                          <div className="flex gap-2">
                            <Badge className={getStatusColor(ticket.status)}>
                              {getStatusIcon(ticket.status)}
                              <span className="ml-1">
                                {ticket.status.charAt(0).toUpperCase() +
                                  ticket.status.slice(1)}
                              </span>
                            </Badge>
                            <Badge variant="outline">{ticket.service}</Badge>
                          </div>
                        </div>
                        {ticket.windowId && (
                          <div className="text-right text-sm text-muted-foreground">
                            Window {ticket.windowId}
                          </div>
                        )}
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        {ticket.ownerName && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Customer
                            </p>
                            <p className="font-medium">{ticket.ownerName}</p>
                          </div>
                        )}
                        {ticket.woreda && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Woreda
                            </p>
                            <p className="font-medium">{ticket.woreda}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Created
                          </p>
                          <p className="font-medium">
                            {formatTime(ticket.createdAt)}
                          </p>
                        </div>
                        {ticket.completedAt && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Completed
                            </p>
                            <p className="font-medium">
                              {formatTime(ticket.completedAt)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Selected Services */}
                      {ticket.selectedServices && ticket.selectedServices.length > 0 && (
                        <div className="border-t pt-2">
                          <p className="text-xs text-muted-foreground mb-2">
                            Selected Services
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ticket.selectedServices.map((service, index) => (
                              <Badge key={index} variant="secondary">
                                {service}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {(ticket.notes || ticket.remark) && (
                        <div className="border-t pt-2 text-sm">
                          {ticket.notes && (
                            <p className="text-xs text-muted-foreground">
                              Notes: {ticket.notes}
                            </p>
                          )}
                          {ticket.remark && (
                            <p className="text-xs text-muted-foreground">
                              Remark: {ticket.remark}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

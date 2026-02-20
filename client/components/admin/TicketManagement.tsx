import { useState, useMemo, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Search,
  Filter,
  DownloadCloud,
  CheckCircle,
  SkipForward,
  Clock,
  Pause,
  ChevronDown,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import type { QueueSnapshot, Ticket, ListUsersResponse } from "@shared/api";
import { ProcessFlowChart } from "../teller/ProcessFlowChart";
import { CompletedTicketSummary } from "../teller/CompletedTicketSummary";

const ITEMS_PER_PAGE = 10;

export default function TicketManagement() {
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [searchCode, setSearchCode] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("transferred");
  const [currentPage, setCurrentPage] = useState(1);
  const [employeeMap, setEmployeeMap] = useState<Record<string, string>>({});

  // Fetch employees list to get names
  const { data: usersResponse, isError: usersError } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        const response = await apiFetch("/api/admin/users");
        return response as ListUsersResponse;
      } catch (error) {
        console.error("Failed to fetch users:", error);
        return { users: [] };
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Build employee map when users data is available
  useMemo(() => {
    if (usersResponse?.users && Array.isArray(usersResponse.users)) {
      const map = usersResponse.users.reduce(
        (acc, user) => {
          acc[user.id] = user.fullName || user.username;
          return acc;
        },
        {} as Record<string, string>
      );
      setEmployeeMap(map);
    }
  }, [usersResponse]);

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
    let filtered = ticketList;

    // For hold/transferred tickets, show all-time; for others, show only today's
    if (filterStatus === "transferred") {
      // Hold tickets: show all-time tickets with "on_hold" status
      filtered = filtered.filter((t) => t.status === "en_hold" || t.status === "on_hold");
    } else {
      // Other statuses: show only today's tickets
      filtered = filtered.filter((t) => {
        const ticketDate = new Date(t.createdAt).toDateString();
        return ticketDate === today;
      });

      if (filterStatus !== "all") {
        filtered = filtered.filter((t) => t.status === filterStatus);
      }
    }

    if (searchCode) {
      filtered = filtered.filter((t) =>
        t.code.includes(searchCode.toUpperCase()),
      );
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [ticketList, searchCode, filterStatus]);

  const statusCounts = useMemo(() => {
    const todayTickets = ticketList.filter((t) => {
      const ticketDate = new Date(t.createdAt).toDateString();
      return ticketDate === today;
    });

    return {
      all: todayTickets.length,
      waiting: todayTickets.filter((t) => t.status === "waiting").length,
      serving: todayTickets.filter((t) => t.status === "serving").length,
      done: todayTickets.filter((t) => t.status === "done").length,
      skipped: todayTickets.filter((t) => t.status === "skipped").length,
      hold: ticketList.filter((t) => t.status === "en_hold" || t.status === "on_hold").length, // All-time count for on-hold status tickets
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
        return "bg-orange-100 text-orange-800";
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
        return <Pause className="h-4 w-4" />;
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
      "Service Category",
      "Selected Services",
      "Window ID",
      "Customer Name",
      "Woreda",
      "Created At",
      "Started At",
      "Completed At",
      "Notes",
    ];

    if (filterStatus === "transferred") {
      headers.splice(8, 0, "Employee Name");
    }

    const rows = filteredTickets.map((t) => {
      const row = [
        t.code,
        t.status,
        t.service,
        t.serviceCategory || "",
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
      ];

      if (filterStatus === "transferred" && t.transferredToUserId) {
        row.splice(8, 0, employeeMap[t.transferredToUserId] || "—");
      }

      return row;
    });

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
        onValueChange={(value) => {
          setFilterStatus(value);
          setCurrentPage(1);
        }}
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
            <Pause className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Hold</span>
            <span className="sm:hidden">({statusCounts.hold})</span>
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
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Code</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">
                        Customer Name
                      </TableHead>
                      <TableHead className="font-semibold">Woreda</TableHead>
                      <TableHead className="font-semibold">
                        Service Category
                      </TableHead>
                      <TableHead className="font-semibold">
                        Selected Services
                      </TableHead>
                      {filterStatus === "transferred" && (
                        <TableHead className="font-semibold">Employee Name</TableHead>
                      )}
                      <TableHead className="font-semibold">Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterStatus === "transferred" && filteredTickets.length > ITEMS_PER_PAGE
                      ? filteredTickets
                          .slice(
                            (currentPage - 1) * ITEMS_PER_PAGE,
                            currentPage * ITEMS_PER_PAGE
                          )
                          .map((ticket) => (
                            <TableRow key={ticket.id}>
                              <TableCell className="font-medium">
                                {ticket.code}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    ticket.status === "done"
                                      ? "default"
                                      : ticket.status === "skipped"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                >
                                  {ticket.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{ticket.ownerName || "—"}</TableCell>
                              <TableCell>{ticket.woreda || "—"}</TableCell>
                              <TableCell>{ticket.serviceCategory || "—"}</TableCell>
                              <TableCell>
                                {ticket.selectedServices &&
                                ticket.selectedServices.length > 0
                                  ? ticket.selectedServices.join(", ")
                                  : "—"}
                              </TableCell>
                              {filterStatus === "transferred" && ticket.transferredToUserId && (
                                <TableCell>
                                  {employeeMap[ticket.transferredToUserId] || "—"}
                                </TableCell>
                              )}
                              <TableCell>
                                {format(new Date(ticket.createdAt), "MMM dd, HH:mm")}
                              </TableCell>
                            </TableRow>
                          ))
                      : filteredTickets.map((ticket) => (
                          <TableRow key={ticket.id}>
                            <TableCell className="font-medium">
                              {ticket.code}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  ticket.status === "done"
                                    ? "default"
                                    : ticket.status === "skipped"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {ticket.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{ticket.ownerName || "—"}</TableCell>
                            <TableCell>{ticket.woreda || "—"}</TableCell>
                            <TableCell>{ticket.serviceCategory || "—"}</TableCell>
                            <TableCell>
                              {ticket.selectedServices &&
                              ticket.selectedServices.length > 0
                                ? ticket.selectedServices.join(", ")
                                : "—"}
                            </TableCell>
                            {ticket.transferredToUserId && filterStatus === "transferred" && (
                              <TableCell>
                                {employeeMap[ticket.transferredToUserId] || "—"}
                              </TableCell>
                            )}
                            <TableCell>
                              {format(new Date(ticket.createdAt), "MMM dd, HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </Card>

              {filterStatus === "transferred" && filteredTickets.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)} of{" "}
                    {filteredTickets.length} tickets
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(
                            Math.ceil(filteredTickets.length / ITEMS_PER_PAGE),
                            prev + 1
                          )
                        )
                      }
                      disabled={
                        currentPage >=
                        Math.ceil(filteredTickets.length / ITEMS_PER_PAGE)
                      }
                      variant="outline"
                      size="sm"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

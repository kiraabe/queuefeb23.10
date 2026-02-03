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
  ArrowRightLeft,
  ChevronDown,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import type { QueueSnapshot, Ticket, ListUsersResponse } from "@shared/api";
import { ProcessFlowChart } from "../teller/ProcessFlowChart";
import { CompletedTicketSummary } from "../teller/CompletedTicketSummary";

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
      "Service Category",
      "Selected Services",
      "Window ID",
      "Customer Name",
      "Woreda",
      "Land Certificate (ካርታ) No.",
      "Land Certificate (ዲጂታል ካርታ) No.",
      "Created At",
      "Started At",
      "Completed At",
      "Notes",
    ];

    const rows = filteredTickets.map((t) => [
      t.code,
      t.status,
      t.service,
      t.serviceCategory || "",
      t.selectedServices?.join("; ") || "",
      t.windowId || "",
      t.ownerName || "",
      t.woreda || "",
      t.landCertificateKarta || "",
      t.landCertificateDigital || "",
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
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Customer Name</TableHead>
                    <TableHead className="font-semibold">Woreda</TableHead>
                    <TableHead className="font-semibold">Service</TableHead>
                    <TableHead className="font-semibold">Service Category</TableHead>
                    <TableHead className="font-semibold">Selected Services</TableHead>
                    <TableHead className="font-semibold">ካርታ No.</TableHead>
                    <TableHead className="font-semibold">ዲጂታል ካርታ No.</TableHead>
                    <TableHead className="font-semibold">Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.code}</TableCell>
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
                      <TableCell>{ticket.service || "—"}</TableCell>
                      <TableCell>{ticket.serviceCategory || "—"}</TableCell>
                      <TableCell>
                        {ticket.selectedServices && ticket.selectedServices.length > 0
                          ? ticket.selectedServices.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>{ticket.landCertificateKarta || "—"}</TableCell>
                      <TableCell>{ticket.landCertificateDigital || "—"}</TableCell>
                      <TableCell>{format(new Date(ticket.createdAt), "MMM dd, HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

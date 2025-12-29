import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2, Package, Zap, LogOut } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Ticket } from "@shared/api";

interface EmployeeStats {
  receivedToday: number;
  completedToday: number;
  avgProcessingSecondsToday: number | null;
}

interface EmployeeTicketsResponse {
  items: Ticket[];
  total: number;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function calculateDuration(
  startTime: number | null | undefined,
  endTime: number | null | undefined,
): number | null {
  if (!startTime || !endTime) return null;
  return Math.round((endTime - startTime) / 1000);
}

interface TicketRowProps {
  ticket: Ticket;
}

const TicketRow = ({ ticket }: TicketRowProps) => {
  const duration = calculateDuration(ticket.transferredAt, ticket.completedAt);
  const statusColor =
    ticket.status === "done"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 rounded-lg border border-border/60 bg-card/50 p-3 sm:p-4 hover:bg-card/80 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-display font-semibold text-foreground truncate">
            Ticket {ticket.code}
          </h3>
          <Badge
            className={`text-xs whitespace-nowrap ${statusColor}`}
            variant="secondary"
          >
            {ticket.status === "done" ? "Completed" : "Received"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Owner: {ticket.ownerName || "—"} · Woreda: {ticket.woreda || "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          Category: {ticket.serviceCategory || "—"}
        </p>
        {ticket.notes && (
          <p className="text-xs text-muted-foreground mt-1">
            Notes: {ticket.notes}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        <div className="text-sm font-semibold text-foreground">
          {formatDuration(duration)}
        </div>
        <p className="text-xs text-muted-foreground">
          {ticket.transferredAt
            ? new Date(ticket.transferredAt).toLocaleTimeString()
            : "—"}
        </p>
        {ticket.completedAt && (
          <p className="text-xs text-muted-foreground">
            to {new Date(ticket.completedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default function Employee() {
  const [tab, setTab] = useState<string>("received");
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const statsQuery = useQuery({
    queryKey: ["employee-stats"],
    queryFn: () => apiFetch<EmployeeStats>("/api/employee/stats"),
    refetchInterval: 10000,
  });

  const ticketsQuery = useQuery({
    queryKey: ["employee-tickets", tab],
    queryFn: () =>
      apiFetch<EmployeeTicketsResponse>(
        `/api/employee/tickets?tab=${encodeURIComponent(tab)}`,
      ),
  });

  const stats = statsQuery.data;
  const tickets = ticketsQuery.data?.items || [];

  const tabItems = useMemo(() => {
    if (tab === "completed") {
      return tickets
        .filter((t) => t.status === "done")
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    }
    // received
    return tickets
      .filter((t) => t.status === "transferred")
      .sort((a, b) => (b.transferredAt || 0) - (a.transferredAt || 0));
  }, [tickets, tab]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Employee Dashboard
            </h1>
            <p className="text-muted-foreground">
              Track your daily cases and performance metrics
            </p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cases Received
              </CardTitle>
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.receivedToday ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cases Completed
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.completedToday ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg. Processing Time
              </CardTitle>
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatDuration(stats?.avgProcessingSecondsToday)}
              </div>
              <p className="text-xs text-muted-foreground">Per case</p>
            </CardContent>
          </Card>
        </div>

        {/* Cases Tab View */}
        <Card>
          <CardHeader>
            <CardTitle>Cases</CardTitle>
            <CardDescription>
              View your received and completed cases for today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList>
                <TabsTrigger value="received">Received Cases</TabsTrigger>
                <TabsTrigger value="completed">Completed Cases</TabsTrigger>
              </TabsList>

              <TabsContent value="received" className="space-y-4 mt-4">
                {ticketsQuery.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading cases...
                  </div>
                ) : tabItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No cases received yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tabItems.map((ticket) => (
                      <TicketRow key={ticket.id} ticket={ticket} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4 mt-4">
                {ticketsQuery.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading cases...
                  </div>
                ) : tabItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No cases completed yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tabItems.map((ticket) => (
                      <TicketRow key={ticket.id} ticket={ticket} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, Clock, Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QueueTicket {
  id: string;
  code: string;
  service: string;
  ownerName?: string;
  woreda?: string;
  createdAt: number;
  serviceCategory?: string;
  queuePosition: number;
  isLocked: boolean;
  waitDuration: number;
}

interface GlobalQueuePanelProps {
  onTicketSelected: (ticketId: string, ticketCode: string) => void;
  selectedTicketId?: string;
}

export function GlobalQueuePanel({
  onTicketSelected,
  selectedTicketId,
}: GlobalQueuePanelProps) {
  const queryClient = useQueryClient();
  const [startingTicketId, setStartingTicketId] = useState<string | null>(null);

  // Fetch global queue
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["archiever-global-queue"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/archiever/global-queue");

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Your session has expired or you don't have permission. Please log in again.",
          );
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Failed to fetch global queue (${response.status})`,
          );
        }

        return response.json() as Promise<{ tickets: QueueTicket[] }>;
      } catch (fetchError) {
        if (
          fetchError instanceof TypeError &&
          fetchError.message.includes("fetch")
        ) {
          throw new Error(
            "Cannot connect to server. Please check your connection and try again.",
          );
        }
        throw fetchError;
      }
    },
    refetchInterval: 3000, // Refresh every 3 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Start ticket mutation
  const { mutate: startTicket, isPending: isStarting } = useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await fetch(`/api/archiever/tickets/${ticketId}/start`, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start ticket");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["archiever-global-queue"] });
      onTicketSelected(data.ticket.id, data.ticket.code);
      toast.success(`Started working on ticket ${data.ticket.code}`);
      setStartingTicketId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to start ticket");
      setStartingTicketId(null);
    },
  });

  const tickets = data?.tickets ?? [];
  const waitingTickets = tickets.filter((t) => !t.isLocked);
  const lockedTickets = tickets.filter((t) => t.isLocked);

  const handleStartTicket = (ticketId: string) => {
    setStartingTicketId(ticketId);
    startTicket(ticketId);
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Waiting for Archiver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {waitingTickets.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tickets in global queue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Being Processed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {lockedTickets.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tickets claimed by archivers
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Queue</CardTitle>
          <CardDescription>
            Tickets waiting for document retrieval (FIFO order)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error instanceof Error
                    ? error.message
                    : "Failed to load queue. Please try again."}
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          ) : waitingTickets.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium">Queue is empty</p>
              <p className="text-sm text-muted-foreground">
                No tickets waiting for document retrieval
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {waitingTickets.map((ticket, index) => (
                <div
                  key={ticket.id}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all",
                    selectedTicketId === ticket.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-sm font-bold">
                          #{ticket.queuePosition}
                        </Badge>
                        <p className="text-xl font-bold text-blue-600">
                          {ticket.code}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Customer
                          </p>
                          <p className="font-medium">
                            {ticket.ownerName || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Service
                          </p>
                          <p className="font-medium">
                            {ticket.service || "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            Waiting: {formatWaitTime(ticket.waitDuration)}
                          </span>
                        </div>
                        {ticket.woreda && <span>Woreda: {ticket.woreda}</span>}
                      </div>
                    </div>

                    <Button
                      onClick={() => handleStartTicket(ticket.id)}
                      disabled={startingTicketId === ticket.id}
                      className="whitespace-nowrap"
                      size="sm"
                    >
                      {startingTicketId === ticket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Start"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {lockedTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Currently Being Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lockedTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => onTicketSelected(ticket.id, ticket.code)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left cursor-pointer",
                    selectedTicketId === ticket.id
                      ? "border-amber-500 bg-amber-50"
                      : "border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{ticket.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.ownerName || "N/A"} • {ticket.service}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-xs whitespace-nowrap ml-2"
                  >
                    In Progress
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WaitingTicket {
  id: string;
  code: string;
  service: string;
  number: number;
  ownerName?: string;
  woreda?: string;
  createdAt: number;
  status: string;
  documentsFetched: boolean;
  documentsFetchedAt?: number | null;
}

export default function Archiever() {
  const queryClient = useQueryClient();
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(
    new Set(),
  );

  // Fetch waiting documents
  const { data, isLoading, error } = useQuery({
    queryKey: ["archiever-documents"],
    queryFn: async () => {
      const response = await fetch("/api/archiever/documents");
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json() as Promise<{ tickets: WaitingTicket[] }>;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Mark documents as fetched mutation
  const { mutate: markFetched, isPending: isMarking } = useMutation({
    mutationFn: async (ticketId: string) => {
      const response = await fetch(
        `/api/archiever/documents/${ticketId}/fetch`,
        {
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        },
      );
      if (!response.ok) throw new Error("Failed to mark documents as fetched");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["archiever-documents"] });
      setSelectedTickets((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.ticket.id);
        return newSet;
      });
      toast.success(
        `Documents marked as fetched for ticket ${data.ticket.code}`,
      );
    },
    onError: () => {
      toast.error("Failed to mark documents as fetched");
    },
  });

  const tickets = data?.tickets ?? [];
  const pendingDocuments = tickets.filter((t) => !t.documentsFetched);
  const fetchedDocuments = tickets.filter((t) => t.documentsFetched);

  const handleMarkFetched = (ticketId: string) => {
    markFetched(ticketId);
  };

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTickets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  const handleMarkSelectedFetched = () => {
    for (const ticketId of selectedTickets) {
      handleMarkFetched(ticketId);
    }
    setSelectedTickets(new Set());
  };

  return (
    <ConsoleShell
      title="Archiever Dashboard"
      description="Manage document fetching for customer tickets"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Waiting for Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {pendingDocuments.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tickets pending document fetch
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Documents Fetched Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {fetchedDocuments.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Completed document pickups
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{tickets.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All tickets requiring documents
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Documents Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pending Documents</CardTitle>
                <CardDescription>
                  Tickets waiting for document fetch confirmation
                </CardDescription>
              </div>
              {selectedTickets.size > 0 && (
                <Button
                  onClick={handleMarkSelectedFetched}
                  disabled={isMarking || selectedTickets.size === 0}
                  className="gap-2"
                >
                  {isMarking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Mark {selectedTickets.size} as Fetched
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load documents. Please try again.
                </AlertDescription>
              </Alert>
            ) : pendingDocuments.length === 0 ? (
              <div className="text-center py-12">
                <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground">
                  No pending documents at the moment
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingDocuments.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border",
                      "hover:bg-accent transition-colors",
                      selectedTickets.has(ticket.id) && "bg-accent",
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedTickets.has(ticket.id)}
                        onChange={() => toggleTicketSelection(ticket.id)}
                        className="h-4 w-4 rounded cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          Ticket {ticket.code}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.ownerName && (
                            <>Customer: {ticket.ownerName} • </>
                          )}
                          Service: {ticket.service}
                          {ticket.woreda && ` • ${ticket.woreda}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created:{" "}
                          {new Date(ticket.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleMarkFetched(ticket.id)}
                      disabled={isMarking}
                      size="sm"
                      className="gap-2 whitespace-nowrap ml-4"
                    >
                      {isMarking ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Fetched
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fetched Documents Section */}
        {fetchedDocuments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Documents Fetched</CardTitle>
              <CardDescription>
                Tickets with documents already marked as fetched
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fetchedDocuments.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-green-200 bg-green-50"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          Ticket {ticket.code}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.ownerName && (
                            <>Customer: {ticket.ownerName} • </>
                          )}
                          Service: {ticket.service}
                          {ticket.woreda && ` • ${ticket.woreda}`}
                        </p>
                        {ticket.documentsFetchedAt && (
                          <p className="text-xs text-green-600">
                            Fetched:{" "}
                            {new Date(
                              ticket.documentsFetchedAt,
                            ).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ConsoleShell>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, Check, X, Clock, User, MapPin, Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TicketDetails {
  id: string;
  code: string;
  service: string;
  number: number;
  ownerName: string;
  woreda: string;
  serviceCategory: string;
  createdAt: number;
  archiverStartedAt: number;
  requiredDocuments: string[];
  documentChecklist: Record<string, { status: string; verifiedAt?: string }>;
  internalNotes: string;
  documentsFetched: boolean;
}

interface ActiveTicketWorkspaceProps {
  ticketId: string;
  onTicketRetrieved?: () => void;
  onReleaseTicket?: () => void;
}

export function ActiveTicketWorkspace({ ticketId, onTicketRetrieved, onReleaseTicket }: ActiveTicketWorkspaceProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [processingTime, setProcessingTime] = useState("0m");

  // Fetch ticket details
  const { data, isLoading, error } = useQuery({
    queryKey: ["archiever-ticket-details", ticketId],
    queryFn: async () => {
      const response = await fetch(`/api/archiever/tickets/${ticketId}/details`);
      if (!response.ok) throw new Error("Failed to fetch ticket details");
      return response.json() as Promise<{ ticket: TicketDetails }>;
    },
    enabled: !!ticketId,
    refetchInterval: 5000,
  });

  // Add internal notes mutation
  const { mutate: addNotes, isPending: isAddingNotes } = useMutation({
    mutationFn: async (notesText: string) => {
      const response = await fetch(`/api/archiever/tickets/${ticketId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ notes: notesText }),
      });
      if (!response.ok) throw new Error("Failed to add notes");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["archiever-ticket-details", ticketId] });
      toast.success("Notes saved");
    },
    onError: () => {
      toast.error("Failed to save notes");
    },
  });

  // Update document checklist mutation
  const { mutate: updateDocument, isPending: isUpdatingDocument } = useMutation({
    mutationFn: async (documentData: { documentName: string; status: string }) => {
      const response = await fetch(`/api/archiever/tickets/${ticketId}/document-checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(documentData),
      });
      if (!response.ok) throw new Error("Failed to update document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archiever-ticket-details", ticketId] });
      toast.success("Document status updated");
    },
    onError: () => {
      toast.error("Failed to update document");
    },
  });

  // Mark retrieved mutation
  const { mutate: markRetrieved, isPending: isMarking } = useMutation({
    mutationFn: async (overrideValidation?: boolean) => {
      const response = await fetch(`/api/archiever/tickets/${ticketId}/retrieved`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ overrideValidation: overrideValidation || false }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archiever-global-queue"] });
      queryClient.invalidateQueries({ queryKey: ["archiever-ticket-details", ticketId] });
      toast.success("Ticket moved to service-specific repository");
      onTicketRetrieved?.();
    },
    onError: (error: any) => {
      if (error.missingDocuments) {
        toast.error(`Missing documents: ${error.missingDocuments.join(", ")}`);
      } else {
        toast.error(error.error || "Failed to mark ticket as retrieved");
      }
    },
  });

  // Release ticket mutation
  const { mutate: releaseTicket, isPending: isReleasing } = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/archiever/tickets/${ticketId}/release`, {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!response.ok) throw new Error("Failed to release ticket");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archiever-global-queue"] });
      queryClient.invalidateQueries({ queryKey: ["archiever-ticket-details", ticketId] });
      toast.success("Ticket released back to global queue");
      onReleaseTicket?.();
    },
    onError: () => {
      toast.error("Failed to release ticket");
    },
  });

  const ticket = data?.ticket;

  // Update processing time every 30 seconds
  useEffect(() => {
    if (!ticket?.archiverStartedAt) return;

    const updateTime = () => {
      const now = Date.now();
      const started = ticket.archiverStartedAt;
      const diffMs = now - started;
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffSeconds = Math.floor((diffMs % 60000) / 1000);

      if (diffMinutes === 0) {
        setProcessingTime(`${diffSeconds}s`);
      } else {
        setProcessingTime(`${diffMinutes}m ${diffSeconds}s`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [ticket?.archiverStartedAt]);

  // Initialize notes from ticket
  useEffect(() => {
    if (ticket?.internalNotes) {
      setNotes(ticket.internalNotes);
    }
  }, [ticket?.internalNotes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load ticket details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!ticket) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No ticket selected. Choose a ticket from the global queue to start.
        </AlertDescription>
      </Alert>
    );
  }

  const verifiedCount = Object.values(ticket.documentChecklist).filter(
    (doc) => doc.status === "verified"
  ).length;
  const totalRequired = ticket.requiredDocuments.length;
  const allVerified = verifiedCount === totalRequired && totalRequired > 0;

  return (
    <div className="space-y-4">
      {/* Ticket Header */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Ticket Code</p>
              <p className="text-2xl font-bold text-blue-600">{ticket.code}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Customer Name</p>
              <p className="font-semibold">{ticket.ownerName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Service Category</p>
              <p className="font-semibold">{ticket.serviceCategory}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Processing Time</p>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-blue-600" />
                <p className="font-semibold text-blue-600">{processingTime}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ticket Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Owner Name</p>
              </div>
              <p className="font-medium">{ticket.ownerName}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Woreda</p>
              </div>
              <p className="font-medium">{ticket.woreda || "N/A"}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Service</p>
              </div>
              <p className="font-medium">{ticket.service}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Document Checklist</CardTitle>
              <CardDescription>
                Mark documents as found/verified
              </CardDescription>
            </div>
            <Badge variant={allVerified ? "default" : "outline"}>
              {verifiedCount}/{totalRequired}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {totalRequired === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No required documents for this service
            </p>
          ) : (
            <div className="space-y-3">
              {ticket.requiredDocuments.map((doc) => {
                const status = ticket.documentChecklist[doc]?.status || "pending";
                return (
                  <div
                    key={doc}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      status === "verified"
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    <div>
                      <p className="font-medium text-sm">{doc}</p>
                      {status === "verified" && (
                        <p className="text-xs text-green-600">
                          Verified at {new Date(ticket.documentChecklist[doc]?.verifiedAt || Date.now()).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() =>
                        updateDocument({
                          documentName: doc,
                          status: status === "verified" ? "pending" : "verified",
                        })
                      }
                      disabled={isUpdatingDocument}
                      size="sm"
                      variant={status === "verified" ? "default" : "outline"}
                      className="gap-2"
                    >
                      {isUpdatingDocument ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : status === "verified" ? (
                        <>
                          <Check className="h-4 w-4" />
                          Found
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          Not Found
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Internal Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Internal Notes (Archiver Only)</CardTitle>
          <CardDescription>
            Not visible to customer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes about this ticket..."
            className="resize-none"
            rows={4}
          />
          <Button
            onClick={() => addNotes(notes)}
            disabled={isAddingNotes}
            size="sm"
          >
            {isAddingNotes ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Save Notes"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 sticky bottom-0 bg-white p-4 rounded-lg border">
        <Button
          onClick={() => {
            if (allVerified) {
              markRetrieved(false);
            } else {
              markRetrieved(true);
            }
          }}
          disabled={isMarking}
          className="flex-1"
          size="lg"
        >
          {isMarking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Retrieved - Move to Service Queue
            </>
          )}
        </Button>
        <Button
          onClick={() => releaseTicket()}
          disabled={isReleasing}
          variant="outline"
          size="lg"
        >
          {isReleasing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Releasing...
            </>
          ) : (
            <>
              <X className="h-4 w-4 mr-2" />
              Return to Global Queue
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

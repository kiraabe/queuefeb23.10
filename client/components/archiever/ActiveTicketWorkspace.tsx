import {
  Loader2,
  AlertCircle,
  Check,
  X,
  Clock,
  User,
  MapPin,
  Tag,
} from "lucide-react";
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
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  documentsFetched: boolean;
  landCertificateKarta?: string;
  landCertificateDigital?: string;
}

interface ActiveTicketWorkspaceProps {
  ticketId: string;
  onTicketRetrieved?: () => void;
  onReleaseTicket?: () => void;
}

export function ActiveTicketWorkspace({
  ticketId,
  onTicketRetrieved,
  onReleaseTicket,
}: ActiveTicketWorkspaceProps) {
  const queryClient = useQueryClient();
  const [processingTime, setProcessingTime] = useState("0m");

  // Fetch ticket details
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["archiever-ticket-details", ticketId],
    queryFn: async () => {
      try {
        const response = await fetch(
          `/api/archiever/tickets/${ticketId}/details`,
        );

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Your session has expired or you don't have permission. Please log in again.",
          );
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Failed to fetch ticket details (${response.status})`,
          );
        }

        return response.json() as Promise<{ ticket: TicketDetails }>;
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
    enabled: !!ticketId,
    refetchInterval: 5000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Update document checklist mutation
  const { mutate: updateDocument, isPending: isUpdatingDocument } = useMutation(
    {
      mutationFn: async (documentData: {
        documentName: string;
        status: string;
      }) => {
        const response = await fetch(
          `/api/archiever/tickets/${ticketId}/document-checklist`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify(documentData),
          },
        );
        if (!response.ok) throw new Error("Failed to update document");
        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["archiever-ticket-details", ticketId],
        });
        toast.success("Document status updated");
      },
      onError: () => {
        toast.error("Failed to update document");
      },
    },
  );

  // Mark retrieved mutation
  const { mutate: markRetrieved, isPending: isMarking } = useMutation({
    mutationFn: async (overrideValidation?: boolean) => {
      const response = await fetch(
        `/api/archiever/tickets/${ticketId}/retrieved`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            overrideValidation: overrideValidation || false,
          }),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archiever-global-queue"] });
      queryClient.invalidateQueries({
        queryKey: ["archiever-ticket-details", ticketId],
      });
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
      const response = await fetch(
        `/api/archiever/tickets/${ticketId}/release`,
        {
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        },
      );
      if (!response.ok) throw new Error("Failed to release ticket");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archiever-global-queue"] });
      queryClient.invalidateQueries({
        queryKey: ["archiever-ticket-details", ticketId],
      });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : "Failed to load ticket details. Please try again."}
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} variant="outline" className="w-full">
          Try Again
        </Button>
      </div>
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
    (doc) => doc.status === "verified",
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
          {(ticket.landCertificateKarta || ticket.landCertificateDigital) && (
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                Land Certificates
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ticket.landCertificateKarta && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">
                      Land Certificate (ካርታ) ser no.
                    </p>
                    <p className="font-medium text-blue-700">
                      {ticket.landCertificateKarta}
                    </p>
                  </div>
                )}
                {ticket.landCertificateDigital && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">
                      Digital Certificate (ዲጂታል ካርታ) No.
                    </p>
                    <p className="font-medium text-green-700">
                      {ticket.landCertificateDigital}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
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
                const status =
                  ticket.documentChecklist[doc]?.status || "pending";
                return (
                  <div
                    key={doc}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      status === "verified"
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 bg-white",
                    )}
                  >
                    <div>
                      <p className="font-medium text-sm">{doc}</p>
                      {status === "verified" && (
                        <p className="text-xs text-green-600">
                          Verified at{" "}
                          {new Date(
                            ticket.documentChecklist[doc]?.verifiedAt ||
                              Date.now(),
                          ).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() =>
                        updateDocument({
                          documentName: doc,
                          status:
                            status === "verified" ? "pending" : "verified",
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

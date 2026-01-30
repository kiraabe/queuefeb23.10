import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Ticket } from "@shared/api";
import { AlertCircle, Loader2 } from "lucide-react";
import { apiCall } from "@/lib/api";

interface FieldVisitActionButtonProps {
  ticket: Ticket;
  onSuccess?: () => void;
}

export function FieldVisitActionButton({
  ticket,
  onSuccess,
}: FieldVisitActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldWorkNotes, setFieldWorkNotes] = useState("");
  const [assignmentPolicy, setAssignmentPolicy] = useState<
    "queue_new_ticket" | "direct_assignment"
  >("queue_new_ticket");

  const handleSubmit = async () => {
    if (!fieldWorkNotes.trim()) {
      setError("Please provide field work notes");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiCall(
        "POST",
        `/employee/tickets/${ticket.id}/require-field-visit`,
        {
          fieldWorkNotes,
          assignmentPolicy,
        },
      );

      setOpen(false);
      setFieldWorkNotes("");
      setAssignmentPolicy("queue_new_ticket");
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initiate field visit",
      );
    } finally {
      setLoading(false);
    }
  };

  if (ticket.status !== "serving" && ticket.status !== "transferred") {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
      >
        <AlertCircle className="w-4 h-4 mr-2" />
        Requires Field Visit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Initiate Field Visit</DialogTitle>
            <DialogDescription>
              Mark this service as requiring field work. The ticket will be
              removed from the queue and the case will remain active for
              multi-day work.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Ticket Info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm font-medium text-blue-900">
                Ticket: {ticket.code}
              </p>
            </div>

            {/* Field Work Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Field Work Notes *</Label>
              <Textarea
                id="notes"
                placeholder="Describe the field work required (e.g., site visit needed for property inspection)"
                value={fieldWorkNotes}
                onChange={(e) => setFieldWorkNotes(e.target.value)}
                className="min-h-24"
              />
            </div>

            {/* Assignment Policy */}
            <div className="space-y-3">
              <Label>After Field Work is Complete</Label>
              <RadioGroup
                value={assignmentPolicy}
                onValueChange={(value) =>
                  setAssignmentPolicy(
                    value as "queue_new_ticket" | "direct_assignment",
                  )
                }
              >
                <div className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                  <RadioGroupItem value="queue_new_ticket" id="policy-queue" />
                  <Label
                    htmlFor="policy-queue"
                    className="cursor-pointer flex-1"
                  >
                    <span className="font-medium">
                      Generate New Daily Ticket
                    </span>
                    <p className="text-xs text-gray-600">
                      Create a new ticket to rejoin the queue (FIFO from
                      readiness time)
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                  <RadioGroupItem
                    value="direct_assignment"
                    id="policy-direct"
                  />
                  <Label
                    htmlFor="policy-direct"
                    className="cursor-pointer flex-1"
                  >
                    <span className="font-medium">Direct Assignment</span>
                    <p className="text-xs text-gray-600">
                      Assign case directly to a specific employee (no queue)
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Initiating...
                </>
              ) : (
                "Initiate Field Visit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

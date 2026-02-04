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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Ticket } from "@shared/api";
import { Loader2, Pause } from "lucide-react";
import { apiCall } from "@/lib/api";

interface HoldCaseDialogProps {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function HoldCaseDialog({
  ticket,
  open,
  onOpenChange,
  onSuccess,
}: HoldCaseDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiCall("POST", `/api/employee/cases/${ticket.id}/hold`, {
        subject,
        description,
      });

      setSubject("");
      setDescription("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to place case on hold",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="w-5 h-5 text-yellow-600" />
            Place Case On Hold
          </DialogTitle>
          <DialogDescription>
            Pause this case while waiting for customer documents or at end of
            day. The case will remain visible and be resumed when ready.
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

          {/* Subject Field */}
          <div className="space-y-2">
            <Label htmlFor="subject">Hold Reason / Subject *</Label>
            <Input
              id="subject"
              placeholder="e.g., Waiting for customer documents"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Details (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe what is needed or what was done before hold (e.g., 'Awaiting property ownership documents from customer. Already completed initial assessment.')"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              className="min-h-32"
            />
          </div>

          {/* Note */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <p className="font-medium mb-1">Important:</p>
            <ul className="space-y-1 list-disc pl-4">
              <li><strong>3-day Hold Deadline:</strong> The case remains on hold for exactly 72 hours (3 days)</li>
              <li>Resume the case when customer returns with required documents</li>
              <li>If customer does not respond within 72 hours, the case will be automatically cancelled</li>
              <li>Time on hold will not count toward processing metrics</li>
              <li>Case will remain visible in "Received Cases" during the hold period</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Placing on hold...
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Place On Hold
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

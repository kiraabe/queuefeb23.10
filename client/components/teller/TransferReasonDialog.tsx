import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface TransferReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason?: string) => void;
  isLoading?: boolean;
  targetWindowName?: string;
}

export function TransferReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  targetWindowName = "selected window",
}: TransferReasonDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason || undefined);
    setReason("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Ticket</DialogTitle>
          <DialogDescription>
            Transferring to {targetWindowName}. You can optionally provide a
            reason for this transfer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transfer-reason">Reason (optional)</Label>
            <Textarea
              id="transfer-reason"
              placeholder="e.g., Service not available, Customer request, Load balancing..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-24 resize-none"
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Transferring..." : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

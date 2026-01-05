import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  User,
  MapPin,
  Layers,
  StickyNote,
  Clock,
  CheckCircle,
} from "lucide-react";
import type { Ticket } from "@shared/api";

interface ProceedHandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
  ticket: Ticket | null;
  targetUserName?: string;
  targetWindowName?: string;
}

const formatDate = (timestamp: number | undefined): string => {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "—";
  }
};

const formatDuration = (seconds: number | undefined): string => {
  if (!seconds || seconds < 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

export function ProceedHandoffDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  ticket,
  targetUserName = "selected user",
  targetWindowName,
}: ProceedHandoffDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!ticket) {
    return null;
  }

  const handoffDuration = ticket.startedAt
    ? Math.floor((Date.now() - ticket.startedAt) / 1000)
    : null;

  const descriptionText = targetWindowName
    ? `Proceeding ticket ${ticket.code} to ${targetUserName} at ${targetWindowName}`
    : `Proceeding ticket ${ticket.code} to ${targetUserName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Proceed Ticket Handoff</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {/* Ticket Summary */}
          <div className="rounded-lg bg-gradient-to-br from-primary/10 via-accent/5 to-background border border-border/60 p-4">
            <div className="flex items-end justify-between gap-4 mb-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wider">
                  Ticket Number
                </p>
                <h3 className="font-display text-3xl font-bold tracking-widest text-primary">
                  {ticket.code}
                </h3>
              </div>
              <Badge variant="secondary" className="text-xs">
                {ticket.service}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Customer Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              Customer Information
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {ticket.ownerName && (
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
                    <User className="h-3.5 w-3.5 flex-shrink-0" /> Full Name
                  </div>
                  <p className="text-sm font-medium truncate">
                    {ticket.ownerName}
                  </p>
                </div>
              )}
              {ticket.woreda && (
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" /> Woreda
                  </div>
                  <p className="text-sm font-medium truncate">
                    {ticket.woreda}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Service Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              Service Information
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {ticket.serviceCategory && (
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
                    <Layers className="h-3.5 w-3.5 flex-shrink-0" /> Service
                    Category
                  </div>
                  <p className="text-sm font-medium truncate">
                    {ticket.serviceCategory}
                  </p>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
                  <Layers className="h-3.5 w-3.5 flex-shrink-0" /> Service Type
                </div>
                <p className="text-sm font-medium truncate">
                  {ticket.service || "—"}
                </p>
              </div>
            </div>
            {ticket.selectedServices && ticket.selectedServices.length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-2">
                  Selected Services
                </p>
                <div className="flex flex-wrap gap-2">
                  {ticket.selectedServices.map((serviceName) => (
                    <Badge
                      key={serviceName}
                      variant="outline"
                      className="text-xs"
                    >
                      {serviceName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Dates & Timeline */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
              Timeline
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" /> Received
                  Date
                </div>
                <p className="text-sm font-medium">
                  {formatDate(ticket.createdAt)}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" /> Handoff
                  Duration
                </div>
                <p className="text-sm font-medium">
                  {formatDuration(handoffDuration)}
                </p>
              </div>
              {ticket.startedAt && (
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-1">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" /> Service
                    Started
                  </div>
                  <p className="text-sm font-medium">
                    {formatDate(ticket.startedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {ticket.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground tracking-wide">
                  <StickyNote className="h-4 w-4 flex-shrink-0" /> Notes
                </div>
                <div className="rounded bg-muted/50 p-3 border border-border/40">
                  <p className="text-sm whitespace-pre-wrap">{ticket.notes}</p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Handoff Reason */}
          <div className="space-y-2">
            <Label htmlFor="handoff-reason" className="text-sm font-semibold">
              Handoff Reason (optional)
            </Label>
            <Textarea
              id="handoff-reason"
              placeholder="e.g., Service specialization, Customer request, Load balancing, Issue resolution..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-20 resize-none"
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" /> Proceeding...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" /> Proceed Handoff
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

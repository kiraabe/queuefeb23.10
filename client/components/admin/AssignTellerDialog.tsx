import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { UserInfo } from "@shared/api";

interface AssignTellerDialogProps {
  open: boolean;
  windowId: number;
  windowName: string;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignTellerDialog({
  open,
  windowId,
  windowName,
  onClose,
  onAssigned,
}: AssignTellerDialogProps) {
  const [allTellers, setAllTellers] = useState<UserInfo[]>([]);
  const [allWindows, setAllWindows] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [assignedTeller, setAssignedTeller] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTellerUsername, setNewTellerUsername] = useState("");
  const [newTellerPassword, setNewTellerPassword] = useState("");
  const [selectedTellerId, setSelectedTellerId] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, windowId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [usersRes, windowsRes] = await Promise.all([
        fetch("/api/admin/users", {
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }),
        fetch("/api/admin/windows", {
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }),
      ]);

      if (!usersRes.ok || !windowsRes.ok) {
        throw new Error("Failed to load data");
      }

      const usersData = await usersRes.json();
      const windowsData = await windowsRes.json();

      const tellers = (usersData.users || []).filter(
        (u: UserInfo) => u.role === "teller",
      );
      setAllTellers(tellers);
      setAllWindows(windowsData.windows || []);

      // Find the teller assigned to this window
      const assigned = tellers.find((t) => t.windowId === windowId);
      setAssignedTeller(assigned || null);
    } catch (error) {
      console.error("Failed to load data", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignExistingTeller = async (tellerId: string) => {
    try {
      setIsSaving(true);
      const response = await fetch(
        `/api/admin/users/${tellerId}/assign-window`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ windowId }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign teller");
      }

      await response.json();
      toast.success("Teller assigned successfully");
      onAssigned();
      onClose();
    } catch (error) {
      console.error("Failed to assign teller", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to assign teller",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAndAssignTeller = async () => {
    const username = newTellerUsername.trim().toLowerCase();
    const password = newTellerPassword.trim();

    if (!username || !password) {
      toast.error("Username and password are required");
      return;
    }

    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          username,
          password,
          role: "teller",
          windowId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create teller");
      }

      await response.json();
      toast.success("Teller created and assigned successfully");
      onAssigned();
      onClose();
    } catch (error) {
      console.error("Failed to create teller", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create teller",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnassignTeller = async () => {
    if (!assignedTeller) return;

    try {
      setIsSaving(true);
      const response = await fetch(
        `/api/admin/users/${assignedTeller.id}/assign-window`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ windowId: null }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unassign teller");
      }

      await response.json();
      setAssignedTeller(null);
      toast.success("Teller unassigned successfully");
      onAssigned();
    } catch (error) {
      console.error("Failed to unassign teller", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign teller",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Teller to {windowName}</DialogTitle>
          <DialogDescription>
            Select an existing teller or create a new one for this window
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Currently Assigned Teller */}
          {assignedTeller && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {assignedTeller.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Currently assigned
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleUnassignTeller}
                  disabled={isSaving}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Assign Existing Teller */}
          {!assignedTeller && allTellers.filter((t) => !t.windowId).length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="existing-teller">Assign Existing Teller</Label>
              <Select
                value={selectedTellerId}
                onValueChange={setSelectedTellerId}
                disabled={isSaving}
              >
                <SelectTrigger id="existing-teller">
                  <SelectValue placeholder="Select an unassigned teller" />
                </SelectTrigger>
                <SelectContent>
                  {allTellers
                    .filter((teller) => !teller.windowId)
                    .map((teller) => (
                      <SelectItem key={teller.id} value={teller.id}>
                        {teller.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (selectedTellerId) {
                    handleAssignExistingTeller(selectedTellerId);
                  } else {
                    toast.error("Please select a teller");
                  }
                }}
                disabled={isSaving || !selectedTellerId}
                className="w-full"
              >
                Assign Selected Teller
              </Button>
            </div>
          )}

          {/* Create New Teller */}
          {!assignedTeller && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Or Create New Teller</Label>
              <Input
                placeholder="Username"
                value={newTellerUsername}
                onChange={(e) => setNewTellerUsername(e.target.value)}
                disabled={isSaving || isLoading}
              />
              <Input
                type="password"
                placeholder="Password"
                value={newTellerPassword}
                onChange={(e) => setNewTellerPassword(e.target.value)}
                disabled={isSaving || isLoading}
              />
              <Button
                onClick={handleCreateAndAssignTeller}
                disabled={isSaving || isLoading}
                className="w-full"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create & Assign New Teller
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

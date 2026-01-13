import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Edit2,
  X,
  Check,
  Users,
  Key,
  Copy,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AssignTellerDialog from "./AssignTellerDialog";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  WindowInfo,
  ListWindowsResponse,
  UpdateWindowResponse,
  ListServiceCategoriesResponse,
} from "@shared/api";

interface WindowWithServices extends WindowInfo {
  assignedServices?: Array<{ code: string; name: string }>;
}

export default function WindowManagement() {
  const [windows, setWindows] = useState<WindowWithServices[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingWindowId, setEditingWindowId] = useState<number | null>(null);
  const [editingWindowName, setEditingWindowName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedWindowForAssign, setSelectedWindowForAssign] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Add window state
  const [newWindowName, setNewWindowName] = useState("");
  const [isAddingWindow, setIsAddingWindow] = useState(false);

  // Password reset state
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordConfirmOpen, setResetPasswordConfirmOpen] =
    useState(false);
  const [selectedWindowForReset, setSelectedWindowForReset] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [newWindowPassword, setNewWindowPassword] = useState<string | null>(
    null,
  );
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Delete window state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedWindowForDelete, setSelectedWindowForDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isDeletingWindow, setIsDeletingWindow] = useState(false);

  // Service selection state
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [selectedWindowForServices, setSelectedWindowForServices] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [serviceCategories, setServiceCategories] = useState<
    Array<{ id: string; code: string; name: string }>
  >([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(),
  );
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isSavingServices, setIsSavingServices] = useState(false);
  const [windowServices, setWindowServices] = useState<
    Record<number, Array<{ code: string; name: string }>>
  >({});

  useEffect(() => {
    const loadData = async () => {
      await loadServiceCategories();
    };
    loadData();
  }, []);

  useEffect(() => {
    if (serviceCategories.length > 0) {
      loadWindows();
    }
  }, [serviceCategories]);

  const loadServiceCategories = async () => {
    try {
      setError(null);
      const response = await fetch("/api/service-categories", {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to load service categories: ${response.status}`);
      }
      const data: ListServiceCategoriesResponse = await response.json();
      setServiceCategories(data.categories || []);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to load service categories";
      console.error("Failed to load service categories", error);
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const loadWindowServices = async (windowId: number) => {
    try {
      const response = await fetch(`/api/admin/windows/${windowId}/services`, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to load window services: ${response.status}`);
      }
      const data = await response.json();
      const serviceCodes = data.services || [];

      // Map service codes to service names using serviceCategories
      const assignedServices = serviceCodes
        .map((code: string) => {
          const category = serviceCategories.find((c) => c.code === code);
          return category
            ? { code, name: category.name }
            : { code, name: code };
        })
        .sort(
          (
            a: { code: string; name: string },
            b: { code: string; name: string },
          ) => a.name.localeCompare(b.name),
        );

      setWindowServices((prev) => ({
        ...prev,
        [windowId]: assignedServices,
      }));
    } catch (error) {
      console.error(`Failed to load services for window ${windowId}`, error);
    }
  };

  const loadWindows = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/admin/windows", {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to load windows: ${response.status}`);
      }
      const data: ListWindowsResponse = await response.json();
      setWindows(data.windows);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to load windows";
      console.error("Failed to load windows", error);
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newWindowName.trim();

    if (!name) {
      toast.error("Window name is required");
      return;
    }

    setIsAddingWindow(true);
    try {
      const response = await fetch("/api/admin/windows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create window");
      }

      setNewWindowName("");
      await loadWindows();
      toast.success("Window created successfully");
    } catch (error) {
      console.error("Failed to create window", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create window",
      );
    } finally {
      setIsAddingWindow(false);
    }
  };

  const handleEditWindow = (windowId: number, currentName: string) => {
    setEditingWindowId(windowId);
    setEditingWindowName(currentName);
  };

  const handleSaveWindow = async (windowId: number) => {
    const name = editingWindowName.trim();

    if (!name) {
      toast.error("Window name is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/windows/${windowId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update window");
      }

      const data: UpdateWindowResponse = await response.json();
      setWindows(windows.map((w) => (w.id === windowId ? data.window : w)));
      setEditingWindowId(null);
      toast.success("Window updated successfully");
    } catch (error) {
      console.error("Failed to update window", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update window",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedWindowForReset) return;

    setIsResettingPassword(true);
    try {
      const response = await fetch(
        `/api/admin/windows/${selectedWindowForReset.id}/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }

      const data = await response.json();
      setNewWindowPassword(data.password);
      setResetPasswordConfirmOpen(false);
      setResetPasswordDialogOpen(true);

      // Auto-download credentials
      setTimeout(() => {
        downloadWindowPassword(selectedWindowForReset.id, data.password);
      }, 500);
    } catch (error) {
      console.error("Failed to reset password", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reset password",
      );
      setResetPasswordConfirmOpen(false);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteWindow = async () => {
    if (!selectedWindowForDelete) return;

    setIsDeletingWindow(true);
    try {
      const response = await fetch(
        `/api/admin/windows/${selectedWindowForDelete.id}`,
        {
          method: "DELETE",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete window");
      }

      setDeleteConfirmOpen(false);
      setSelectedWindowForDelete(null);
      await loadWindows();
      toast.success("Window deleted successfully");
    } catch (error) {
      console.error("Failed to delete window", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete window",
      );
      setDeleteConfirmOpen(false);
    } finally {
      setIsDeletingWindow(false);
    }
  };

  const downloadWindowPassword = (windowId: number, password: string) => {
    const content = `Window ID: ${windowId}\nPassword: ${password}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `window-${windowId}-password.txt`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
    toast.success("Password downloaded");
  };

  const copyPassword = () => {
    if (!newWindowPassword) return;
    navigator.clipboard.writeText(newWindowPassword);
    toast.success("Password copied to clipboard");
  };

  const handleOpenServiceDialog = async (windowId: number, name: string) => {
    setSelectedWindowForServices({ id: windowId, name });
    setIsLoadingServices(true);
    setServiceDialogOpen(true);

    try {
      const response = await fetch(`/api/admin/windows/${windowId}/services`, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to load window services");
      }
      const data = await response.json();
      setSelectedServices(new Set(data.services || []));

      // Update cached window services
      await loadWindowServices(windowId);
    } catch (error) {
      console.error("Failed to load window services", error);
      toast.error("Failed to load window services");
    } finally {
      setIsLoadingServices(false);
    }
  };

  const handleSaveServices = async () => {
    if (!selectedWindowForServices) return;

    setIsSavingServices(true);
    try {
      const response = await fetch(
        `/api/admin/windows/${selectedWindowForServices.id}/services`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            services: Array.from(selectedServices),
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save window services");
      }

      // Reload the services for this window
      await loadWindowServices(selectedWindowForServices.id);

      toast.success("Window services updated successfully");
      setServiceDialogOpen(false);
      setSelectedWindowForServices(null);
    } catch (error) {
      console.error("Failed to save window services", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save window services",
      );
    } finally {
      setIsSavingServices(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Windows</CardTitle>
        <CardDescription>
          View and edit service window information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={handleAddWindow}
          className="space-y-3 rounded-lg border p-4 bg-muted/30"
        >
          <div>
            <Label htmlFor="windowTitle" className="text-sm font-medium">
              Add New Window
            </Label>
          </div>
          <div className="flex gap-2">
            <Input
              id="windowTitle"
              type="text"
              placeholder="Enter window title"
              value={newWindowName}
              onChange={(e) => setNewWindowName(e.target.value)}
              disabled={isAddingWindow}
            />
            <Button
              type="submit"
              disabled={isAddingWindow || !newWindowName.trim()}
              className="whitespace-nowrap"
            >
              {isAddingWindow ? "Creating..." : "Add Window"}
            </Button>
          </div>
        </form>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading windows...</p>
        ) : windows.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No windows found</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {windows.map((window) => (
              <div
                key={window.id}
                className="flex items-center gap-2 rounded-lg border p-3"
              >
                {editingWindowId === window.id ? (
                  <>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Window {window.id}
                      </p>
                      <Input
                        value={editingWindowName}
                        onChange={(e) => setEditingWindowName(e.target.value)}
                        placeholder="Window name"
                        className="h-8"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSaveWindow(window.id)}
                      disabled={isSaving}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingWindowId(null)}
                      disabled={isSaving}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{window.name}</p>
                      <div className="mt-1 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {window.tellerCount} teller
                          {window.tellerCount !== 1 ? "s" : ""} assigned
                        </p>
                        {windowServices[window.id] &&
                          windowServices[window.id].length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {windowServices[window.id].map((service) => (
                                <span
                                  key={service.code}
                                  className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                                >
                                  {service.name}
                                </span>
                              ))}
                            </div>
                          )}
                        {!windowServices[window.id] ? (
                          <p className="text-xs text-muted-foreground">
                            Click icon to configure services
                          </p>
                        ) : windowServices[window.id].length === 0 ? (
                          <p className="text-xs text-amber-600">
                            No service categories assigned
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleOpenServiceDialog(window.id, window.name)
                      }
                      className="h-8 w-8 p-0"
                      title="Configure service types"
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedWindowForAssign({
                          id: window.id,
                          name: window.name,
                        });
                        setAssignDialogOpen(true);
                      }}
                      className="h-8 w-8 p-0"
                      title="Assign teller"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedWindowForReset({
                          id: window.id,
                          name: window.name,
                        });
                        setResetPasswordConfirmOpen(true);
                      }}
                      className="h-8 w-8 p-0"
                      title="Reset window password"
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditWindow(window.id, window.name)}
                      className="h-8 w-8 p-0"
                      title="Edit window name"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedWindowForDelete({
                          id: window.id,
                          name: window.name,
                        });
                        setDeleteConfirmOpen(true);
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Delete window"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedWindowForAssign && (
          <AssignTellerDialog
            open={assignDialogOpen}
            windowId={selectedWindowForAssign.id}
            windowName={selectedWindowForAssign.name}
            onClose={() => {
              setAssignDialogOpen(false);
              setSelectedWindowForAssign(null);
            }}
            onAssigned={() => loadWindows()}
          />
        )}
      </CardContent>

      <AlertDialog
        open={resetPasswordConfirmOpen}
        onOpenChange={setResetPasswordConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset the password for{" "}
              <strong>{selectedWindowForReset?.name}</strong>? A new password
              will be generated and downloaded automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              disabled={isResettingPassword}
            >
              {isResettingPassword ? "Resetting..." : "Reset Password"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Window</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{selectedWindowForDelete?.name}</strong>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWindow}
              disabled={isDeletingWindow}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingWindow ? "Deleting..." : "Delete Window"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password Reset Successfully</DialogTitle>
            <DialogDescription>
              New password for {selectedWindowForReset?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                New Password
              </p>
              <p className="font-mono text-sm break-all">{newWindowPassword}</p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={copyPassword}
                variant="outline"
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button
                onClick={() => {
                  if (newWindowPassword && selectedWindowForReset) {
                    downloadWindowPassword(
                      selectedWindowForReset.id,
                      newWindowPassword,
                    );
                  }
                }}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              ⚠️ Share this password securely with the window user.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setResetPasswordDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Service Type Restrictions</DialogTitle>
            <DialogDescription>
              Select which service categories {selectedWindowForServices?.name}{" "}
              should handle
            </DialogDescription>
          </DialogHeader>

          {isLoadingServices ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {serviceCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No service categories found
                </p>
              ) : (
                serviceCategories.map((category) => (
                  <div key={category.code} className="flex items-center gap-3">
                    <Checkbox
                      id={`service-${category.code}`}
                      checked={selectedServices.has(category.code)}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedServices);
                        if (checked) {
                          newSelected.add(category.code);
                        } else {
                          newSelected.delete(category.code);
                        }
                        setSelectedServices(newSelected);
                      }}
                    />
                    <label
                      htmlFor={`service-${category.code}`}
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {category.name}
                    </label>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setServiceDialogOpen(false)}
              disabled={isSavingServices}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveServices}
              disabled={isSavingServices || isLoadingServices}
            >
              {isSavingServices ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

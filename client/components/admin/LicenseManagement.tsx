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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Edit, Lock, AlertCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type {
  ListLicensesResponse,
  CreateLicenseResponse,
  LicenseRecord,
  UpdateLicenseStatusResponse,
} from "@shared/api";

export default function LicenseManagement() {
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form state for creating license
  const [formData, setFormData] = useState({
    licenseKey: "",
    licensee: "",
    expiresAt: "",
    notes: "",
  });

  // Load licenses on mount
  useEffect(() => {
    loadLicenses();
  }, []);

  const loadLicenses = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/licenses", {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load licenses");
      }

      const data: ListLicensesResponse = await response.json();
      setLicenses(data.licenses);
    } catch (error) {
      console.error("Failed to load licenses:", error);
      toast.error("Failed to load licenses");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.licenseKey.trim() || !formData.licensee.trim()) {
      toast.error("License key and licensee name are required");
      return;
    }

    if (formData.licenseKey.length < 8) {
      toast.error("License key must be at least 8 characters long");
      return;
    }

    setIsSubmitting(true);
    try {
      const expiresAt = formData.expiresAt
        ? new Date(formData.expiresAt).getTime()
        : undefined;

      const response = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          licenseKey: formData.licenseKey.trim(),
          licensee: formData.licensee.trim(),
          expiresAt,
          notes: formData.notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create license");
      }

      const data: CreateLicenseResponse = await response.json();
      toast.success("License created successfully");

      // Add new license to list
      if (data.license) {
        setLicenses([data.license, ...licenses]);
      }

      // Reset form
      setFormData({
        licenseKey: "",
        licensee: "",
        expiresAt: "",
        notes: "",
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create license:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create license",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    licenseKey: string,
    newStatus: "active" | "inactive" | "expired" | "revoked",
  ) => {
    try {
      const response = await fetch(
        `/api/admin/licenses/${encodeURIComponent(licenseKey)}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update license status");
      }

      const data: UpdateLicenseStatusResponse = await response.json();
      toast.success(`License status updated to ${newStatus}`);

      // Update license in list
      setLicenses(
        licenses.map((l) =>
          l.licenseKey === licenseKey ? data.license! : l,
        ),
      );
    } catch (error) {
      console.error("Failed to update license status:", error);
      toast.error("Failed to update license status");
    }
  };

  const handleDeleteLicense = async (licenseKey: string) => {
    if (!confirm(`Are you sure you want to delete the license "${licenseKey}"?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/licenses/${encodeURIComponent(licenseKey)}`,
        {
          method: "DELETE",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete license");
      }

      toast.success("License deleted successfully");
      setLicenses(licenses.filter((l) => l.licenseKey !== licenseKey));
    } catch (error) {
      console.error("Failed to delete license:", error);
      toast.error("Failed to delete license");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "expired":
        return "bg-yellow-100 text-yellow-800";
      case "revoked":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const isExpired = (expiresAt: number | null) => {
    if (!expiresAt) return false;
    return Date.now() > expiresAt;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">License Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage application licenses for buyers
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create License
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New License</DialogTitle>
              <DialogDescription>
                Generate a new license for a buyer. The license key must be at
                least 8 characters long.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateLicense} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="licenseKey">License Key *</Label>
                <Input
                  id="licenseKey"
                  placeholder="e.g., ACME-2024-PROD-KEY"
                  value={formData.licenseKey}
                  onChange={(e) =>
                    setFormData({ ...formData, licenseKey: e.target.value })
                  }
                  disabled={isSubmitting}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier for this license. Share this with the buyer.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="licensee">Licensee Name *</Label>
                <Input
                  id="licensee"
                  placeholder="e.g., Acme Corporation"
                  value={formData.licensee}
                  onChange={(e) =>
                    setFormData({ ...formData, licensee: e.target.value })
                  }
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Name of the company or organization buying the license.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) =>
                    setFormData({ ...formData, expiresAt: e.target.value })
                  }
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for perpetual license.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="e.g., Enterprise plan, 5 users"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  disabled={isSubmitting}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create License"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center items-center h-40">
              <p className="text-muted-foreground">Loading licenses...</p>
            </div>
          </CardContent>
        </Card>
      ) : licenses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No licenses created yet. Click "Create License" to add the first
                one.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Licenses ({licenses.length})</CardTitle>
            <CardDescription>
              List of all licenses. Click the copy icon to copy the license key.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>License Key</TableHead>
                    <TableHead>Licensee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses.map((license) => (
                    <TableRow key={license.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 rounded bg-muted">
                            {license.licenseKey.substring(0, 16)}
                            {license.licenseKey.length > 16 ? "..." : ""}
                          </code>
                          <button
                            onClick={() =>
                              copyToClipboard(license.licenseKey)
                            }
                            className="hover:bg-muted p-1 rounded transition-colors"
                            title="Copy full license key"
                          >
                            {copiedKey === license.licenseKey ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>{license.licensee}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(license.status)}>
                          {license.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {license.expiresAt ? (
                          <span
                            className={
                              isExpired(license.expiresAt)
                                ? "text-red-600"
                                : ""
                            }
                          >
                            {formatDate(license.expiresAt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(license.createdAt)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {license.status === "active" ? (
                          <button
                            onClick={() =>
                              handleUpdateStatus(
                                license.licenseKey,
                                "revoked",
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                          >
                            <Lock className="h-3 w-3" />
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleUpdateStatus(
                                license.licenseKey,
                                "active",
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                          >
                            <Lock className="h-3 w-3" />
                            Restore
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleDeleteLicense(license.licenseKey)
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-destructive/10 text-destructive rounded hover:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

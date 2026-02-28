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
import { Plus, Trash2, Edit, Lock, AlertCircle, Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import type {
  ListLicensesResponse,
  CreateLicenseResponse,
  LicenseRecord,
  UpdateLicenseStatusResponse,
} from "@shared/api";

/**
 * Mask sensitive fields for display (shows first 8 chars + last 4 chars)
 */
function maskField(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 12) {
    return "****";
  }
  const start = value.substring(0, 8);
  const end = value.substring(value.length - 4);
  return `${start}****${end}`;
}

export default function LicenseManagement() {
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedLicenses, setRevealedLicenses] = useState<Set<string>>(new Set());

  // Generate a random license key
  const generateLicenseKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const length = 16;
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Format as XXXX-XXXX-XXXX-XXXX
    return `${result.substring(0, 4)}-${result.substring(4, 8)}-${result.substring(8, 12)}-${result.substring(12, 16)}`;
  };

  // Form state for creating license
  const [formData, setFormData] = useState({
    licenseKey: "",
    licensee: "",
  });

  // Initialize license key when dialog opens
  const handleDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (open && !formData.licenseKey) {
      setFormData({ ...formData, licenseKey: generateLicenseKey() });
    }
  };

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
    if (!formData.licensee.trim()) {
      toast.error("Licensee name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          licenseKey: formData.licenseKey.trim(),
          licensee: formData.licensee.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create license");
      }

      const data: CreateLicenseResponse = await response.json();
      toast.success("License created successfully");

      // Add new license to list and download manual
      if (data.license) {
        setLicenses([data.license, ...licenses]);
        // Auto-download the license manual
        downloadLicenseManual(data.license.licenseKey, data.license.licensee);
      }

      // Reset form
      setFormData({
        licenseKey: "",
        licensee: "",
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

  const downloadLicenseManual = (licenseKey: string, licensee: string) => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const manualContent = `
================================================================================
                          LICENSE ACTIVATION MANUAL
================================================================================

Generated: ${currentDate}

IMPORTANT: Keep this file secure and do not share with unauthorized personnel.

================================================================================
                             LICENSE INFORMATION
================================================================================

Licensee Name: ${licensee}

License Key: ${licenseKey}

================================================================================
                          ACTIVATION INSTRUCTIONS
================================================================================

1. Launch the application
2. Navigate to the License Activation section
3. Enter the License Key provided above: ${licenseKey}
4. Click "Activate License"
5. The application will be activated for ${licensee}

================================================================================
                            IMPORTANT NOTES
================================================================================

- Keep the License Key confidential and secure
- Do not share the License Key with unauthorized users
- Each License Key is unique to ${licensee}
- Contact support if you have issues activating the license
- This license is perpetual and does not expire

================================================================================
                           SUPPORT INFORMATION
================================================================================

For technical support or issues with license activation:
- Email: support@example.com
- Phone: +1-XXX-XXX-XXXX
- Website: https://www.example.com/support

================================================================================
                             END OF DOCUMENT
================================================================================
`;

    // Create a blob and trigger download
    const blob = new Blob([manualContent.trim()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `License-Manual-${licensee.replace(/\s+/g, "-")}-${licenseKey.substring(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleReveal = (licenseId: string) => {
    setRevealedLicenses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(licenseId)) {
        newSet.delete(licenseId);
      } else {
        newSet.add(licenseId);
      }
      return newSet;
    });
  };

  const isRevealed = (licenseId: string) => revealedLicenses.has(licenseId);

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

        <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogOpenChange}>
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
                Generate a new license for a buyer.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateLicense} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="licenseKey">License Key *</Label>
                <div className="flex gap-2">
                  <Input
                    id="licenseKey"
                    value={formData.licenseKey}
                    disabled={true}
                    className="font-mono flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setFormData({ ...formData, licenseKey: generateLicenseKey() })
                    }
                    disabled={isSubmitting}
                    className="px-3"
                  >
                    Regenerate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-generated unique identifier. Click regenerate to create a new key.
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
              List of all licenses. Data is encrypted. Click the eye icon to reveal details.
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
                  {licenses.map((license) => {
                    const isLicenseRevealed = isRevealed(license.id);
                    const maskedKey = maskField(license.licenseKey);
                    const maskedLicensee = maskField(license.licensee);

                    return (
                    <TableRow key={license.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 rounded bg-muted">
                            {isLicenseRevealed
                              ? license.licenseKey.substring(0, 16) +
                                (license.licenseKey.length > 16 ? "..." : "")
                              : maskedKey
                            }
                          </code>
                          <button
                            onClick={() => toggleReveal(license.id)}
                            className="hover:bg-muted p-1 rounded transition-colors"
                            title={isLicenseRevealed ? "Hide details" : "Show details"}
                          >
                            {isLicenseRevealed ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
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
                      <TableCell>
                        {isLicenseRevealed ? license.licensee : maskedLicensee}
                      </TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

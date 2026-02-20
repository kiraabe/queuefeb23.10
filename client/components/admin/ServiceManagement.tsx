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
  Trash2,
  Plus,
  Edit2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface ServiceCategory {
  id: string;
  code: string;
  name: string;
  displayOrder?: number;
}

interface Service {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  standardTimeSeconds?: number;
  displayOrder?: number;
}

// Helper function to format seconds to human-readable time
function formatSeconds(seconds?: number | null): string {
  if (!seconds) return "—";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.length > 0 ? parts.join(" ") : "0s";
}

export default function ServiceManagement() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Category form state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editingCategoryCode, setEditingCategoryCode] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);

  // Service form state
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceCode, setEditingServiceCode] = useState("");
  const [editingServiceName, setEditingServiceName] = useState("");
  const [editingServiceStandardTime, setEditingServiceStandardTime] = useState<
    string
  >("");
  const [newServiceCode, setNewServiceCode] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceStandardTime, setNewServiceStandardTime] = useState<string>(
    "",
  );
  const [newServiceCategoryId, setNewServiceCategoryId] = useState<
    string | null
  >(null);
  const [showAddServiceCategoryId, setShowAddServiceCategoryId] = useState<
    string | null
  >(null);

  // Edit mode state
  const [editingCategoryIdMode, setEditingCategoryIdMode] = useState<
    string | null
  >(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (retries = 3): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/service-categories", {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      if (!res.ok) {
        throw new Error(`Failed to load categories: ${res.status}`);
      }

      const data: { categories: ServiceCategory[] } = await res.json();
      setCategories(data.categories);

      // Load services for each category
      const allServices: Service[] = [];
      for (const category of data.categories) {
        try {
          const servicesRes = await fetch(
            `/api/service-categories/${category.code}/services`,
            {
              headers: { "X-Requested-With": "XMLHttpRequest" },
            },
          );

          if (servicesRes.ok) {
            const servicesData: { services: Service[] } =
              await servicesRes.json();
            allServices.push(...servicesData.services);
          }
        } catch (categoryError) {
          console.warn(
            `Failed to load services for category ${category.id}`,
            categoryError,
          );
        }
      }
      setServices(allServices);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to load categories";
      console.error("Failed to load data", error);

      // Retry with exponential backoff for network errors
      if (retries > 0 && error instanceof TypeError) {
        console.log(`Retrying loadData... (${3 - retries + 1}/3)`);
        setIsLoading(false);
        setTimeout(
          () => loadData(retries - 1),
          Math.pow(2, 3 - retries) * 1000,
        );
        return;
      }

      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      if (retries === 3 || retries < 3) {
        setIsLoading(false);
      }
    }
  };

  const getServicesByCategory = (categoryId: string) => {
    return services.filter((s) => s.categoryId === categoryId);
  };

  const handleAddCategory = async () => {
    const code = newCategoryCode.trim().toUpperCase();
    const name = newCategoryName.trim();

    if (!code) {
      toast.error("Category code is required");
      return;
    }

    if (!name) {
      toast.error("Category name is required");
      return;
    }

    try {
      const response = await fetch("/api/admin/service-categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ code, name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create category");
      }

      const data: { category: ServiceCategory } = await response.json();
      setCategories([...categories, data.category]);
      setNewCategoryCode("");
      setNewCategoryName("");
      setShowAddCategory(false);

      toast.success("Service category created successfully");
    } catch (error) {
      console.error("Failed to create category", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create category",
      );
    }
  };

  const handleAddService = async (categoryId: string) => {
    const code = newServiceCode.trim().toUpperCase();
    const name = newServiceName.trim();
    const standardTimeSecondsValue = newServiceStandardTime
      ? parseInt(newServiceStandardTime, 10)
      : undefined;

    if (!code) {
      toast.error("Service code is required");
      return;
    }

    if (!name) {
      toast.error("Service name is required");
      return;
    }

    if (newServiceStandardTime && isNaN(standardTimeSecondsValue || 0)) {
      toast.error("Standard time must be a valid number (seconds)");
      return;
    }

    try {
      const response = await fetch("/api/admin/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          categoryId,
          code,
          name,
          standardTimeSeconds: standardTimeSecondsValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create service");
      }

      const data: { service: Service } = await response.json();
      setServices([...services, data.service]);
      setNewServiceCode("");
      setNewServiceName("");
      setNewServiceStandardTime("");
      setShowAddServiceCategoryId(null);

      toast.success("Service created successfully");
    } catch (error) {
      console.error("Failed to create service", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create service",
      );
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    if (
      !confirm(
        `Are you sure you want to delete category "${category.name}"? This will delete all services in this category.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/service-categories/${categoryId}`,
        {
          method: "DELETE",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete category");
      }

      setCategories(categories.filter((c) => c.id !== categoryId));
      setServices(services.filter((s) => s.categoryId !== categoryId));

      toast.success("Service category deleted successfully");
    } catch (error) {
      console.error("Failed to delete category", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete category",
      );
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    if (
      !confirm(`Are you sure you want to delete service "${service.name}"?`)
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: "DELETE",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete service");
      }

      setServices(services.filter((s) => s.id !== serviceId));

      toast.success("Service deleted successfully");
    } catch (error) {
      console.error("Failed to delete service", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete service",
      );
    }
  };

  const handleEditCategory = async (categoryId: string) => {
    const code = editingCategoryCode.trim().toUpperCase();
    const name = editingCategoryName.trim();

    if (!code) {
      toast.error("Category code is required");
      return;
    }

    if (!name) {
      toast.error("Category name is required");
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/service-categories/${categoryId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({ code, name }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update category");
      }

      const data: { category: ServiceCategory } = await response.json();
      setCategories(
        categories.map((c) => (c.id === categoryId ? data.category : c)),
      );
      setEditingCategoryIdMode(null);
      setEditingCategoryCode("");
      setEditingCategoryName("");

      toast.success("Service category updated successfully");
    } catch (error) {
      console.error("Failed to update category", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update category",
      );
    }
  };

  const handleEditService = async (serviceId: string) => {
    const code = editingServiceCode.trim().toUpperCase();
    const name = editingServiceName.trim();
    const standardTimeSecondsValue = editingServiceStandardTime
      ? parseInt(editingServiceStandardTime, 10)
      : undefined;

    if (!code) {
      toast.error("Service code is required");
      return;
    }

    if (!name) {
      toast.error("Service name is required");
      return;
    }

    if (editingServiceStandardTime && isNaN(standardTimeSecondsValue || 0)) {
      toast.error("Standard time must be a valid number (seconds)");
      return;
    }

    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          code,
          name,
          standardTimeSeconds: standardTimeSecondsValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update service");
      }

      const data: { service: Service } = await response.json();
      setServices(services.map((s) => (s.id === serviceId ? data.service : s)));
      setEditingServiceId(null);
      setEditingServiceCode("");
      setEditingServiceName("");
      setEditingServiceStandardTime("");

      toast.success("Service updated successfully");
    } catch (error) {
      console.error("Failed to update service", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update service",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Service Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Categories</CardTitle>
              <CardDescription>
                Manage service categories and their services
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddCategory(!showAddCategory)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {showAddCategory && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3 mb-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cat-code">Category Code *</Label>
                  <Input
                    id="cat-code"
                    placeholder="e.g., LICENSE"
                    value={newCategoryCode}
                    onChange={(e) => setNewCategoryCode(e.target.value)}
                    className="h-8"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-name">Category Name *</Label>
                  <Input
                    id="cat-name"
                    placeholder="e.g., License Services"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="h-8"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddCategory}
                  disabled={isLoading}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Create Category
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddCategory(false)}
                  disabled={isLoading}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading categories...
            </p>
          ) : categories.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No service categories found</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => {
                const categoryServices = getServicesByCategory(category.id);
                const isExpanded = expandedCategory === category.id;

                return (
                  <div
                    key={category.id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    {/* Category Header */}
                    {editingCategoryIdMode === category.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label
                              htmlFor={`edit-code-${category.id}`}
                              className="text-xs"
                            >
                              Category Code
                            </Label>
                            <Input
                              id={`edit-code-${category.id}`}
                              value={editingCategoryCode}
                              onChange={(e) =>
                                setEditingCategoryCode(e.target.value)
                              }
                              className="h-8 text-sm"
                              disabled={isLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor={`edit-name-${category.id}`}
                              className="text-xs"
                            >
                              Category Name
                            </Label>
                            <Input
                              id={`edit-name-${category.id}`}
                              value={editingCategoryName}
                              onChange={(e) =>
                                setEditingCategoryName(e.target.value)
                              }
                              className="h-8 text-sm"
                              disabled={isLoading}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleEditCategory(category.id)}
                            disabled={isLoading}
                            className="h-8 text-xs gap-1"
                          >
                            <Check className="h-3 w-3" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCategoryIdMode(null);
                              setEditingCategoryCode("");
                              setEditingCategoryName("");
                            }}
                            disabled={isLoading}
                            className="h-8 text-xs gap-1"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div
                          className="flex-1 cursor-pointer flex items-center gap-2"
                          onClick={() =>
                            setExpandedCategory(isExpanded ? null : category.id)
                          }
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-semibold text-sm">
                              {category.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Code: {category.code} • {categoryServices.length}{" "}
                              service
                              {categoryServices.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingCategoryIdMode(category.id);
                              setEditingCategoryCode(category.code);
                              setEditingCategoryName(category.name);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCategory(category.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Services List */}
                    {isExpanded && (
                      <div className="space-y-2 pl-6 border-t pt-3">
                        {categoryServices.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            No services in this category
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {categoryServices.map((service) => (
                              <div key={service.id}>
                                {editingServiceId === service.id ? (
                                  <div className="rounded bg-muted/50 p-3 space-y-2">
                                    <div className="space-y-2">
                                      <Label className="text-xs">
                                        Service Code
                                      </Label>
                                      <Input
                                        value={editingServiceCode}
                                        onChange={(e) =>
                                          setEditingServiceCode(e.target.value)
                                        }
                                        className="h-8 text-sm"
                                        disabled={isLoading}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs">
                                        Service Name
                                      </Label>
                                      <Input
                                        value={editingServiceName}
                                        onChange={(e) =>
                                          setEditingServiceName(e.target.value)
                                        }
                                        className="h-8 text-sm"
                                        disabled={isLoading}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs">
                                        Standard Time (seconds)
                                      </Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="e.g., 1800 for 30 minutes"
                                        value={editingServiceStandardTime}
                                        onChange={(e) =>
                                          setEditingServiceStandardTime(
                                            e.target.value,
                                          )
                                        }
                                        className="h-8 text-sm"
                                        disabled={isLoading}
                                      />
                                      {editingServiceStandardTime && (
                                        <p className="text-xs text-muted-foreground">
                                          {formatSeconds(
                                            parseInt(editingServiceStandardTime, 10),
                                          )}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleEditService(service.id)
                                        }
                                        disabled={isLoading}
                                        className="h-8 text-xs gap-1"
                                      >
                                        <Check className="h-3 w-3" />
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditingServiceId(null);
                                          setEditingServiceCode("");
                                          setEditingServiceName("");
                                        }}
                                        disabled={isLoading}
                                        className="h-8 text-xs gap-1"
                                      >
                                        <X className="h-3 w-3" />
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between rounded bg-muted/50 p-2">
                                    <div className="flex-1 text-sm">
                                      <p className="font-medium">
                                        {service.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Code: {service.code}
                                        {service.standardTimeSeconds && (
                                          <>
                                            {" "}
                                            • Standard Time:{" "}
                                            {formatSeconds(
                                              service.standardTimeSeconds,
                                            )}
                                          </>
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingServiceId(service.id);
                                          setEditingServiceCode(service.code);
                                          setEditingServiceName(service.name);
                                          setEditingServiceStandardTime(
                                            service.standardTimeSeconds
                                              ? String(service.standardTimeSeconds)
                                              : "",
                                          );
                                        }}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          handleDeleteService(service.id)
                                        }
                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Service in Category */}
                        {showAddServiceCategoryId === category.id ? (
                          <div className="space-y-2 border-t pt-2 mt-2">
                            <div className="space-y-2">
                              <Label className="text-xs">Service Code</Label>
                              <Input
                                placeholder="e.g., LICENSE"
                                value={newServiceCode}
                                onChange={(e) =>
                                  setNewServiceCode(e.target.value)
                                }
                                className="h-8 text-sm"
                                disabled={isLoading}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Service Name</Label>
                              <Input
                                placeholder="e.g., License Application"
                                value={newServiceName}
                                onChange={(e) =>
                                  setNewServiceName(e.target.value)
                                }
                                className="h-8 text-sm"
                                disabled={isLoading}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">
                                Standard Time (seconds) - Optional
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="e.g., 1800 for 30 minutes"
                                value={newServiceStandardTime}
                                onChange={(e) =>
                                  setNewServiceStandardTime(e.target.value)
                                }
                                className="h-8 text-sm"
                                disabled={isLoading}
                              />
                              {newServiceStandardTime && (
                                <p className="text-xs text-muted-foreground">
                                  {formatSeconds(
                                    parseInt(newServiceStandardTime, 10),
                                  )}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAddService(category.id)}
                                disabled={isLoading}
                                className="h-8 text-xs gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                Add Service
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShowAddServiceCategoryId(null);
                                  setNewServiceCode("");
                                  setNewServiceName("");
                                  setNewServiceStandardTime("");
                                }}
                                disabled={isLoading}
                                className="h-8 text-xs gap-1"
                              >
                                <X className="h-3 w-3" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setShowAddServiceCategoryId(category.id)
                            }
                            className="w-full h-8 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Service
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Save, Clock } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type {
  GetQueueSettingsResponse,
  UpdateQueueSettingsResponse,
  ListServiceCategoriesResponse,
  ServiceCategory,
  ServiceItem,
} from "@shared/api";

interface ServiceWithCategory extends ServiceItem {
  categoryName?: string;
}

export default function AdminSettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [serviceChanges, setServiceChanges] = useState<Record<string, number>>({});
  const [services, setServices] = useState<ServiceWithCategory[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Queue Settings
  const [queueSettings, setQueueSettings] = useState({
    maxTicketsPerDay: 200,
    fifoMode: true,
    dailyResetTime: "00:00",
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/admin/queue-settings", {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        if (!response.ok) {
          throw new Error("Failed to load settings");
        }
        const data: GetQueueSettingsResponse = await response.json();
        const { settings } = data;
        setQueueSettings({
          maxTicketsPerDay: settings.maxTicketsPerDay,
          fifoMode: settings.fifoMode,
          dailyResetTime: settings.dailyResetTimeUtc,
        });
      } catch (error) {
        console.error("Failed to load queue settings", error);
        toast.error("Failed to load queue settings");
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
    loadServiceCategories();
  }, []);

  const loadServiceCategories = async () => {
    try {
      setServicesLoading(true);
      const categoriesData = await apiFetch<ListServiceCategoriesResponse>(
        "/api/service-categories"
      );

      // Validate the response structure
      if (!categoriesData) {
        throw new Error("No data returned from service categories endpoint");
      }

      const categories = categoriesData.categories;
      if (!Array.isArray(categories)) {
        console.warn("Invalid categories format, expected array but got:", typeof categories);
        setServices([]);
        return;
      }

      const allServices: ServiceWithCategory[] = [];

      // Load services for each category
      for (const category of categories) {
        try {
          const servicesData = await apiFetch<any>(
            `/api/service-categories/${category.id}/services`
          );

          if (servicesData && servicesData.services && Array.isArray(servicesData.services)) {
            servicesData.services.forEach((service: ServiceItem) => {
              allServices.push({
                ...service,
                categoryName: servicesData.categoryName || category.name,
              });
            });
          }
        } catch (err) {
          console.error(`Failed to load services for category ${category.id}`, err);
        }
      }

      setServices(allServices);
    } catch (error) {
      console.error("Failed to load service categories", error);
      toast.error("Failed to load service categories");
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/queue-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          maxTicketsPerDay: queueSettings.maxTicketsPerDay,
          dailyResetTimeUtc: queueSettings.dailyResetTime,
          fifoMode: queueSettings.fifoMode,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }
      const data: UpdateQueueSettingsResponse = await response.json();
      toast.success(data.message);
      setUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save settings", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveServiceTimes = async () => {
    setIsSaving(true);
    try {
      const servicesToUpdate = Object.entries(serviceChanges).map(
        ([serviceId, standardTimeMinutes]) => ({
          serviceId,
          standardTimeMinutes,
        })
      );

      // Update each service
      for (const update of servicesToUpdate) {
        await apiFetch<any>(
          `/api/admin/services/${update.serviceId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              standardTimeMinutes: update.standardTimeMinutes,
            }),
          }
        );
      }

      toast.success("Service standard times updated successfully");
      setServiceChanges({});
      await loadServiceCategories(); // Reload to show updated values
    } catch (error) {
      console.error("Failed to save service times", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save service times"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {unsavedChanges && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Please save before leaving this page.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Queue Configuration</CardTitle>
          <CardDescription>
            Configure how the queue system operates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Max Tickets Per Day */}
          <div className="space-y-2">
            <Label htmlFor="maxTickets">Maximum Tickets Per Day</Label>
            <Input
              id="maxTickets"
              type="number"
              value={queueSettings.maxTicketsPerDay}
              onChange={(e) => {
                setQueueSettings({
                  ...queueSettings,
                  maxTicketsPerDay: parseInt(e.target.value),
                });
                setUnsavedChanges(true);
              }}
              min={1}
              max={1000}
            />
            <p className="text-xs text-muted-foreground">
              Limit new tickets when this threshold is reached
            </p>
          </div>

          {/* Daily Reset Time */}
          <div className="space-y-2">
            <Label htmlFor="resetTime">Daily Reset Time (UTC)</Label>
            <Input
              id="resetTime"
              type="time"
              value={queueSettings.dailyResetTime}
              onChange={(e) => {
                setQueueSettings({
                  ...queueSettings,
                  dailyResetTime: e.target.value,
                });
                setUnsavedChanges(true);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Time when queue counters reset daily
            </p>
          </div>

          {/* FIFO Mode */}
          <div className="space-y-2">
            <Label>Queue Behavior</Label>
            <Select
              value={queueSettings.fifoMode ? "fifo" : "priority"}
              onValueChange={(value) => {
                setQueueSettings({
                  ...queueSettings,
                  fifoMode: value === "fifo",
                });
                setUnsavedChanges(true);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fifo">First-In-First-Out (FIFO)</SelectItem>
                <SelectItem value="priority">
                  Priority-Based (Future)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How customers are selected to be served
            </p>
          </div>

          <Button
            onClick={handleSaveSettings}
            disabled={!unsavedChanges || isSaving || isLoading}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Queue Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Service Standard Times */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Service Standard Times
              </CardTitle>
              <CardDescription>
                Set standard processing time for each service. This will be used to flag
                processes that exceed their standard time in the Process Flow Section.
              </CardDescription>
            </div>
          </div>
          <Alert className="mt-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <strong>Related:</strong> Service standard times can also be set when creating or editing services in the <strong className="font-semibold">Service Categories</strong> tab. Changes made in either location will be synchronized.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="space-y-6">
          {servicesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading services...
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No services found. Please create services first.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-end gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <Label className="text-sm font-semibold">
                        {service.categoryName} - {service.name}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Code: {service.code}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Minutes"
                        className="w-24"
                        value={serviceChanges[service.id] ?? service.standardTimeMinutes ?? ""}
                        onChange={(e) => {
                          const value = e.target.value
                            ? parseInt(e.target.value)
                            : undefined;
                          setServiceChanges((prev) => {
                            const updated = { ...prev };
                            if (value !== undefined && value >= 0) {
                              updated[service.id] = value;
                            } else {
                              delete updated[service.id];
                            }
                            return updated;
                          });
                        }}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        min
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(serviceChanges).length > 0 && (
                <Button
                  onClick={handleSaveServiceTimes}
                  disabled={isSaving}
                  className="w-full"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Service Times"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

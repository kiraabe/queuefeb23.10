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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Save, AlertTriangle, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  GetQueueSettingsResponse,
  UpdateQueueSettingsResponse,
} from "@shared/api";

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("queue");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Queue Settings
  const [queueSettings, setQueueSettings] = useState({
    maxTicketsPerDay: 200,
    fifoMode: true,
    dailyResetTime: "00:00",
    enableTicketTransfers: true,
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
          enableTicketTransfers: settings.enableTicketTransfers,
        });
      } catch (error) {
        console.error("Failed to load queue settings", error);
        toast.error("Failed to load queue settings");
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

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
          enableTicketTransfers: queueSettings.enableTicketTransfers,
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

  const handleSeedTestData = async () => {
    if (!confirm("Create test data with completed workflows? This will add 4 sample cases.")) {
      return;
    }
    setIsSeeding(true);
    try {
      const response = await fetch("/api/admin/seed-test-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to seed test data");
      }
      const data = await response.json();
      toast.success(data.message || "Test data created successfully");
    } catch (error) {
      console.error("Failed to seed test data", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to seed test data",
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearDemo = async () => {
    if (!confirm("Clear all demo data? This will delete all tickets and reset counters.")) {
      return;
    }
    setIsClearing(true);
    try {
      const response = await fetch("/api/admin/clear-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to clear demo data");
      }
      toast.success("All demo data cleared successfully");
    } catch (error) {
      console.error("Failed to clear demo data", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to clear demo data",
      );
    } finally {
      setIsClearing(false);
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="queue">Queue Settings</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        {/* Queue Settings */}
        <TabsContent value="queue">
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
                    <SelectItem value="fifo">
                      First-In-First-Out (FIFO)
                    </SelectItem>
                    <SelectItem value="priority">
                      Priority-Based (Future)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How customers are selected to be served
                </p>
              </div>

              {/* Enable Transfers */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Ticket Transfers</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow staff to transfer tickets between windows
                  </p>
                </div>
                <Select
                  value={
                    queueSettings.enableTicketTransfers ? "enabled" : "disabled"
                  }
                  onValueChange={(value) => {
                    setQueueSettings({
                      ...queueSettings,
                      enableTicketTransfers: value === "enabled",
                    });
                    setUnsavedChanges(true);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
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
        </TabsContent>

        {/* Data Management */}
        <TabsContent value="data" className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Use these tools to manage test data for development and testing purposes.
            </AlertDescription>
          </Alert>

          {/* Seed Test Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Seed Test Data
              </CardTitle>
              <CardDescription>
                Create sample completed cases with workflows for different timeframes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will create 4 sample completed cases with employee workflows:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>2 cases completed today</li>
                <li>1 case completed this week</li>
                <li>1 case completed this month</li>
              </ul>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Note: Requires at least one employee user to exist in the system.
              </p>
              <Button
                onClick={handleSeedTestData}
                disabled={isSeeding}
                className="gap-2"
              >
                <Database className="h-4 w-4" />
                {isSeeding ? "Creating test data..." : "Create Test Data"}
              </Button>
            </CardContent>
          </Card>

          {/* Clear Demo Data */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Clear Demo Data
              </CardTitle>
              <CardDescription>
                Delete all tickets and reset counters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This action is irreversible. All tickets will be permanently deleted.
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleClearDemo}
                disabled={isClearing}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isClearing ? "Clearing..." : "Clear All Data"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

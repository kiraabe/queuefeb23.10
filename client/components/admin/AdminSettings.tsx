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
import { AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import type {
  GetQueueSettingsResponse,
  UpdateQueueSettingsResponse,
} from "@shared/api";

export default function AdminSettings() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

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
    </div>
  );
}

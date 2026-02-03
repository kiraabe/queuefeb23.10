import { AlertCircle, Clock, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface MyActiveWorkIndicatorProps {
  ticketCode?: string;
  startTime?: number;
  onClear?: () => void;
  isWorkingOnTicket?: boolean;
}

export function MyActiveWorkIndicator({
  ticketCode,
  startTime,
  onClear,
  isWorkingOnTicket,
}: MyActiveWorkIndicatorProps) {
  const [elapsedTime, setElapsedTime] = useState("0m 0s");

  useEffect(() => {
    if (!startTime || !isWorkingOnTicket) return;

    const updateTimer = () => {
      const now = Date.now();
      const diffMs = now - startTime;
      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      setElapsedTime(`${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime, isWorkingOnTicket]);

  if (!isWorkingOnTicket || !ticketCode) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <p className="text-muted-foreground">No active ticket</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select a ticket from the global queue to start
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-green-400 bg-green-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full animate-pulse bg-green-500" />
            <CardTitle className="text-base">Currently Processing</CardTitle>
          </div>
          <Badge variant="default">Active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Ticket Code</p>
          <p className="text-2xl font-bold text-green-600">{ticketCode}</p>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-white border">
          <Clock className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Elapsed Time</p>
            <p className="text-lg font-semibold text-green-700">
              {elapsedTime}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Note: Other archivists cannot claim this ticket while you're working
          on it
        </p>
      </CardContent>
    </Card>
  );
}

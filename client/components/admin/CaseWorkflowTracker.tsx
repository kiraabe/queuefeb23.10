import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Clock,
  User,
  ArrowRight,
  ChevronDown,
  Search,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface WorkflowEntry {
  id: string;
  ticketId: string;
  employeeId: string;
  jobTitleId: string;
  startedAt: number | null;
  endedAt: number | null;
  status: "in_progress" | "proceeded" | "completed";
  durationSeconds: number | null;
  employeeName: string;
  jobTitle: string;
  ticketCode: string;
}

interface CaseWorkflow {
  ticketId: string;
  ticketCode: string;
  items: WorkflowEntry[];
  totalDuration: number | null;
}

export default function CaseWorkflowTracker() {
  const [searchTicket, setSearchTicket] = useState("");
  const [workflows, setWorkflows] = useState<CaseWorkflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<CaseWorkflow | null>(
    null
  );
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchTicket.trim()) {
      setError("Please enter a ticket code or ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Search for the ticket first
      const ticketSearchRes = await fetch(
        `/api/admin/daily-report`
      );
      const reportData = await ticketSearchRes.json();

      // Find matching ticket
      const matchingTicket = reportData.allTickets.find(
        (t: any) =>
          t.ticketCode.toLowerCase() === searchTicket.toLowerCase() ||
          t.ticketId.toLowerCase() === searchTicket.toLowerCase()
      );

      if (!matchingTicket) {
        setError("Ticket not found");
        return;
      }

      // Get the workflow for this ticket
      const workflowRes = await fetch(
        `/api/employee/case-workflow?ticketId=${matchingTicket.ticketId}`
      );

      if (!workflowRes.ok) {
        throw new Error("Failed to fetch case workflow");
      }

      const workflowData = await workflowRes.json();

      // Calculate total duration
      let totalDuration = 0;
      if (workflowData.items.length > 0) {
        const first = workflowData.items[0];
        const last = workflowData.items[workflowData.items.length - 1];
        if (first.startedAt && last.endedAt) {
          totalDuration = (last.endedAt - first.startedAt) / 1000;
        }
      }

      const workflow: CaseWorkflow = {
        ticketId: matchingTicket.ticketId,
        ticketCode: matchingTicket.ticketCode,
        items: workflowData.items,
        totalDuration,
      };

      setWorkflows([workflow]);
      setSelectedWorkflow(workflow);
      setIsOpen(true);
      setSearchTicket("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatSeconds = (seconds: number | null) => {
    if (seconds === null || seconds === 0) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (
    status: "in_progress" | "proceeded" | "completed"
  ) => {
    switch (status) {
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "proceeded":
        return "bg-orange-100 text-orange-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: "in_progress" | "proceeded" | "completed") => {
    switch (status) {
      case "in_progress":
        return "In Progress";
      case "proceeded":
        return "Forwarded";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Search Case Workflow</CardTitle>
          <CardDescription>
            Enter a ticket code or ID to view its workflow history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="E.g., S1-045 or ticket ID"
                value={searchTicket}
                onChange={(e) => {
                  setSearchTicket(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Workflow Details Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Case Workflow: {selectedWorkflow?.ticketCode}</DialogTitle>
            <DialogDescription>
              Complete workflow history for this case
            </DialogDescription>
          </DialogHeader>

          {selectedWorkflow && (
            <div className="space-y-6">
              {/* Timeline */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Workflow Timeline</h3>

                {selectedWorkflow.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No workflow entries found
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedWorkflow.items.map((entry, index) => (
                      <div key={entry.id} className="space-y-2">
                        <div className="flex gap-4">
                          {/* Timeline dot and line */}
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-blue-500 mt-1"></div>
                            {index < selectedWorkflow.items.length - 1 && (
                              <div className="w-0.5 h-12 bg-gray-300"></div>
                            )}
                          </div>

                          {/* Entry details */}
                          <div className="flex-1 pb-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {entry.employeeName}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {entry.jobTitle}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${getStatusColor(entry.status)}`}
                                >
                                  {getStatusLabel(entry.status)}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    Started:{" "}
                                    {entry.startedAt
                                      ? format(
                                          new Date(entry.startedAt),
                                          "HH:mm:ss"
                                        )
                                      : "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    Duration:{" "}
                                    {formatSeconds(entry.durationSeconds)}
                                  </span>
                                </div>
                              </div>

                              {entry.endedAt && (
                                <div className="text-xs text-muted-foreground">
                                  Ended:{" "}
                                  {format(new Date(entry.endedAt), "HH:mm:ss")}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Arrow between entries */}
                        {index < selectedWorkflow.items.length - 1 && (
                          <div className="flex items-center justify-center pl-10">
                            <ArrowRight className="h-4 w-4 text-gray-400 rotate-90" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Employees
                    </p>
                    <p className="text-lg font-semibold">
                      {selectedWorkflow.items.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Duration
                    </p>
                    <p className="text-lg font-semibold">
                      {formatSeconds(selectedWorkflow.totalDuration)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent Searches / History */}
      {workflows.length > 0 && !isOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Case Workflows</CardTitle>
            <CardDescription>Click to view details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <button
                  key={workflow.ticketId}
                  onClick={() => {
                    setSelectedWorkflow(workflow);
                    setIsOpen(true);
                  }}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{workflow.ticketCode}</p>
                      <p className="text-sm text-muted-foreground">
                        {workflow.items.length} step
                        {workflow.items.length === 1 ? "" : "s"} •{" "}
                        {formatSeconds(workflow.totalDuration)}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {workflows.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2 py-8">
              <p className="text-muted-foreground">
                Search for a case to view its workflow history
              </p>
              <p className="text-sm text-muted-foreground">
                You'll see the complete path of employees who worked on the case
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

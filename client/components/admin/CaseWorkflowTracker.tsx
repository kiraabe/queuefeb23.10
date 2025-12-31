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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Clock,
  User,
  Search,
  ChevronDown,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";

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

interface TicketInfo {
  ticketCode: string;
  serviceCategory?: string;
  selectedServices?: string[];
}

interface CaseWorkflow {
  ticketId: string;
  ticketCode: string;
  ticketInfo?: TicketInfo;
  items: WorkflowEntry[];
  totalDuration: number | null;
}

export default function CaseWorkflowTracker() {
  const [searchTicket, setSearchTicket] = useState("");
  const [workflows, setWorkflows] = useState<CaseWorkflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<CaseWorkflow | null>(
    null,
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
      const ticketSearchRes = await fetch(`/api/admin/daily-report`);
      const reportData = await ticketSearchRes.json();

      // Find matching ticket
      const matchingTicket = reportData.allTickets.find(
        (t: any) =>
          t.ticketCode.toLowerCase() === searchTicket.toLowerCase() ||
          t.ticketId.toLowerCase() === searchTicket.toLowerCase(),
      );

      if (!matchingTicket) {
        setError("Ticket not found");
        return;
      }

      // Get the workflow for this ticket
      const workflowRes = await fetch(
        `/api/employee/case-workflow?ticketId=${matchingTicket.ticketId}`,
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
        ticketInfo: workflowData.ticketInfo,
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
    status: "in_progress" | "proceeded" | "completed",
  ) => {
    switch (status) {
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      case "proceeded":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (
    status: "in_progress" | "proceeded" | "completed",
  ) => {
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
          <CardTitle>Process Flow Diagram</CardTitle>
          <CardDescription>
            Search for a ticket to view its complete process flow
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

      {/* Workflow Diagram Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center space-y-3">
              <div className="space-y-2">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  Ticket {selectedWorkflow?.ticketInfo?.ticketCode}
                </div>
                {selectedWorkflow?.ticketInfo?.serviceCategory && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-semibold">Service Category:</span>{" "}
                    {selectedWorkflow.ticketInfo.serviceCategory}
                  </div>
                )}
                {selectedWorkflow?.ticketInfo?.selectedServices &&
                  selectedWorkflow.ticketInfo.selectedServices.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold">Services:</span>{" "}
                      {selectedWorkflow.ticketInfo.selectedServices.join(
                        ", ",
                      )}
                    </div>
                  )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedWorkflow && (
            <div className="space-y-6">
              {/* Process Flow Diagram */}
              <div className="space-y-6">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  Process Flow
                </h3>

                {selectedWorkflow.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No process steps found
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Process Flow Nodes */}
                    <div className="flex flex-col gap-3">
                      {selectedWorkflow.items.map((entry, index) => (
                        <div key={entry.id} className="space-y-3">
                          {/* Node */}
                          <div className="flex items-start gap-4">
                            {/* Step number circle */}
                            <div className="flex flex-col items-center">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white font-semibold text-sm flex-shrink-0">
                                {index + 1}
                              </div>
                              {index < selectedWorkflow.items.length - 1 && (
                                <div className="w-0.5 h-24 bg-gradient-to-b from-blue-500 to-blue-200 mt-2"></div>
                              )}
                            </div>

                            {/* Node Content */}
                            <div className="flex-1 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 mt-1">
                              <div className="space-y-3">
                                {/* Employee Name and Status */}
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start gap-3 flex-1">
                                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="font-semibold text-foreground">
                                        {entry.employeeName}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {entry.jobTitle}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(entry.status)}`}
                                    >
                                      {entry.status === "completed" && (
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      )}
                                      {getStatusLabel(entry.status)}
                                    </span>
                                  </div>
                                </div>

                                {/* Timeline Details */}
                                <div className="grid grid-cols-3 gap-3 bg-white dark:bg-background rounded p-3 text-xs">
                                  <div>
                                    <p className="text-muted-foreground font-medium">
                                      Started
                                    </p>
                                    <p className="font-semibold text-foreground">
                                      {entry.startedAt
                                        ? format(
                                            new Date(entry.startedAt),
                                            "HH:mm:ss",
                                          )
                                        : "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground font-medium">
                                      Duration
                                    </p>
                                    <p className="font-semibold text-foreground">
                                      {formatSeconds(entry.durationSeconds)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground font-medium">
                                      Ended
                                    </p>
                                    <p className="font-semibold text-foreground">
                                      {entry.endedAt
                                        ? format(
                                            new Date(entry.endedAt),
                                            "HH:mm:ss",
                                          )
                                        : "—"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Arrow between nodes */}
                          {index < selectedWorkflow.items.length - 1 && (
                            <div className="flex items-center gap-2 pl-5">
                              <ArrowRight className="h-4 w-4 text-blue-400 rotate-90" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Final Step - Completion */}
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white font-semibold text-sm flex-shrink-0">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                      </div>
                      <div className="flex-1 rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 mt-1">
                        <p className="font-semibold text-foreground">
                          Process Complete
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Total Duration:{" "}
                          <span className="font-semibold">
                            {formatSeconds(selectedWorkflow.totalDuration)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Stats */}
              <div className="border-t pt-6 grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground font-medium uppercase">
                    Total Steps
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {selectedWorkflow.items.length}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground font-medium uppercase">
                    Total Duration
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {formatSeconds(selectedWorkflow.totalDuration)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground font-medium uppercase">
                    Employees Involved
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {new Set(selectedWorkflow.items.map((i) => i.employeeId))
                      .size}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent Searches */}
      {workflows.length > 0 && !isOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Searches</CardTitle>
            <CardDescription>Click to view process flow diagram</CardDescription>
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
                  className="w-full text-left p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-blue-600 dark:text-blue-400">
                        Ticket {workflow.ticketCode}
                      </p>
                      {workflow.ticketInfo?.serviceCategory && (
                        <p className="text-sm text-muted-foreground">
                          {workflow.ticketInfo.serviceCategory}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {workflow.items.length} step
                        {workflow.items.length === 1 ? "" : "s"} •{" "}
                        {formatSeconds(workflow.totalDuration)}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
            <div className="text-center space-y-3 py-12">
              <p className="text-muted-foreground">
                Search for a ticket to view its process flow
              </p>
              <p className="text-sm text-muted-foreground">
                See the complete workflow with all employees involved and their
                actions
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

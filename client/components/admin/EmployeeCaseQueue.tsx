import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Clock,
  CheckCircle,
  HourglassIcon,
  User,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Ticket {
  id: string;
  code: string;
  service: string;
  status: string;
  ownerName: string;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  transferredToUserId: string | null;
  transferredAt: number | null;
  notes: string | null;
}

interface EmployeeCaseData {
  employeeName: string;
  employeeId: string;
  receivedCases: Ticket[];
  inProgressCases: Ticket[];
  completedCases: Ticket[];
  forwardedCases: Ticket[];
  stats: {
    totalReceived: number;
    totalCompleted: number;
    averageCaseTime: number | null;
  };
}

export default function EmployeeCaseQueue() {
  const [employeesData, setEmployeesData] = useState<EmployeeCaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const fetchCaseData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch daily report to get all ticket data
      const reportRes = await fetch("/api/admin/daily-report");
      if (!reportRes.ok) {
        throw new Error("Failed to fetch daily report");
      }
      const reportData = await reportRes.json();

      // Group tickets by employee
      const employeeMap = new Map<string, EmployeeCaseData>();

      // Process all tickets
      for (const ticket of reportData.allTickets) {
        // Get case workflow to see which employees worked on this case
        try {
          const workflowRes = await fetch(
            `/api/employee/case-workflow?ticketId=${ticket.ticketId}`,
          );
          if (workflowRes.ok) {
            const workflowData = await workflowRes.json();

            // For each employee in the workflow, add this ticket
            const uniqueEmployees = new Set();
            for (const entry of workflowData.items) {
              if (!uniqueEmployees.has(entry.employeeId)) {
                uniqueEmployees.add(entry.employeeId);

                if (!employeeMap.has(entry.employeeId)) {
                  employeeMap.set(entry.employeeId, {
                    employeeName: entry.employeeName,
                    employeeId: entry.employeeId,
                    receivedCases: [],
                    inProgressCases: [],
                    completedCases: [],
                    forwardedCases: [],
                    stats: {
                      totalReceived: 0,
                      totalCompleted: 0,
                      averageCaseTime: null,
                    },
                  });
                }

                const empData = employeeMap.get(entry.employeeId)!;

                const formattedTicket: Ticket = {
                  id: ticket.ticketId,
                  code: ticket.ticketCode,
                  service: ticket.service,
                  status: ticket.status,
                  ownerName: "", // Would need to enhance daily report
                  createdAt: ticket.createdAt,
                  startedAt: ticket.completedAt ? ticket.createdAt : null,
                  completedAt: ticket.completedAt,
                  transferredToUserId: null,
                  transferredAt: null,
                  notes: null,
                };

                // Categorize by status
                if (ticket.status === "done") {
                  if (
                    !empData.completedCases.find(
                      (t) => t.id === ticket.ticketId,
                    )
                  ) {
                    empData.completedCases.push(formattedTicket);
                  }
                } else if (ticket.status === "transferred") {
                  if (
                    !empData.forwardedCases.find(
                      (t) => t.id === ticket.ticketId,
                    )
                  ) {
                    empData.forwardedCases.push(formattedTicket);
                  }
                } else {
                  if (
                    !empData.receivedCases.find((t) => t.id === ticket.ticketId)
                  ) {
                    empData.receivedCases.push(formattedTicket);
                  }
                }

                empData.stats.totalReceived++;
                if (ticket.status === "done") {
                  empData.stats.totalCompleted++;
                }
              }
            }
          }
        } catch (e) {
          console.warn(
            `Failed to fetch workflow for ticket ${ticket.ticketId}`,
          );
        }
      }

      // Calculate average case times
      const employees = Array.from(employeeMap.values()).sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName),
      );

      setEmployeesData(employees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseData();
  }, []);

  const formatSeconds = (seconds: number | null) => {
    if (seconds === null || seconds === 0) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "done":
        return "bg-green-100 text-green-800";
      case "transferred":
        return "bg-blue-100 text-blue-800";
      case "waiting":
        return "bg-yellow-100 text-yellow-800";
      case "serving":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const TicketRow = ({
    ticket,
    employeeId,
  }: {
    ticket: Ticket;
    employeeId: string;
  }) => (
    <TableRow key={ticket.id}>
      <TableCell className="font-medium">{ticket.code}</TableCell>
      <TableCell>{ticket.service}</TableCell>
      <TableCell>
        <Badge className={getStatusBadgeColor(ticket.status)}>
          {ticket.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {format(new Date(ticket.createdAt), "HH:mm:ss")}
      </TableCell>
      <TableCell className="text-sm">
        {ticket.completedAt
          ? format(new Date(ticket.completedAt), "HH:mm:ss")
          : "—"}
      </TableCell>
    </TableRow>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Case Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading case data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Case Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (employeesData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Case Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No employee case data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Active Employees
                </span>
                <User className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">{employeesData.length}</p>
              <p className="text-xs text-muted-foreground">processing cases</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Cases
                </span>
                <HourglassIcon className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-3xl font-bold">
                {employeesData.reduce(
                  (sum, e) => sum + e.stats.totalReceived,
                  0,
                )}
              </p>
              <p className="text-xs text-muted-foreground">handled</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Completed
                </span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold">
                {employeesData.reduce(
                  (sum, e) => sum + e.stats.totalCompleted,
                  0,
                )}
              </p>
              <p className="text-xs text-muted-foreground">cases</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Cases Breakdown */}
      {employeesData.map((employee) => (
        <Card key={employee.employeeId}>
          <CardHeader
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() =>
              setExpandedEmployee(
                expandedEmployee === employee.employeeId
                  ? null
                  : employee.employeeId,
              )
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {employee.employeeName}
                </CardTitle>
                <CardDescription>
                  {employee.stats.totalReceived} cases received •{" "}
                  {employee.stats.totalCompleted} completed
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-600">
                  {employee.stats.totalCompleted}/{employee.stats.totalReceived}
                </p>
                <p className="text-xs text-muted-foreground">completion rate</p>
              </div>
            </div>
          </CardHeader>

          {expandedEmployee === employee.employeeId && (
            <CardContent className="space-y-6 border-t pt-6">
              {/* Received Cases */}
              {employee.receivedCases.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <HourglassIcon className="h-4 w-4 text-orange-500" />
                    Received Cases ({employee.receivedCases.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Completed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employee.receivedCases.map((ticket) => (
                          <TicketRow
                            key={ticket.id}
                            ticket={ticket}
                            employeeId={employee.employeeId}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* In Progress Cases */}
              {employee.inProgressCases.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    In Progress ({employee.inProgressCases.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Completed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employee.inProgressCases.map((ticket) => (
                          <TicketRow
                            key={ticket.id}
                            ticket={ticket}
                            employeeId={employee.employeeId}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Completed Cases */}
              {employee.completedCases.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Completed ({employee.completedCases.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Completed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employee.completedCases.map((ticket) => (
                          <TicketRow
                            key={ticket.id}
                            ticket={ticket}
                            employeeId={employee.employeeId}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Forwarded Cases */}
              {employee.forwardedCases.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    Forwarded ({employee.forwardedCases.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Completed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employee.forwardedCases.map((ticket) => (
                          <TicketRow
                            key={ticket.id}
                            ticket={ticket}
                            employeeId={employee.employeeId}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

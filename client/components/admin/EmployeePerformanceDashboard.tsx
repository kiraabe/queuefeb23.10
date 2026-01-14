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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingUp,
  Users,
} from "lucide-react";
import { format } from "date-fns";

interface EmployeeStats {
  employeeId: string;
  employeeName: string;
  totalCasesStarted: number;
  casesCompleted: number;
  casesProceed: number;
  averageCaseTime: number | null;
  averageServiceTime: number | null;
  totalTimeSpent: number | null;
}

interface PerformanceMetrics {
  employees: EmployeeStats[];
  generatedAt: string;
  summary: {
    totalEmployees: number;
    totalCasesProcessed: number;
    totalServedTickets: number;
    averageCompletionTime: number | null;
    highestPerformer: EmployeeStats | null;
  };
}

export default function EmployeePerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, fetch daily report to get employee case data
      const reportRes = await fetch("/api/admin/daily-report");
      if (!reportRes.ok) {
        throw new Error("Failed to fetch daily report");
      }
      const reportData = await reportRes.json();

      // Get total served tickets from the daily report summary
      const totalServedTickets = Number(reportData.summary?.served || 0);

      // Use employee performance data directly from the daily report
      // This already has casesCompleted, casesProceed, etc.
      const employeeList = (reportData.employeePerformance || []).map(
        (emp: any) => ({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          totalCasesStarted: Number(emp.totalCasesStarted || 0),
          casesCompleted: Number(emp.casesCompleted || 0),
          casesProceed: Number(emp.casesProceed || 0),
          averageCaseTime: emp.averageCaseTime || null,
          averageServiceTime: null,
          totalTimeSpent: emp.totalTimeSpent || null,
        }),
      );

      // Find highest performer (employee with most completed cases)
      const highestPerformer =
        employeeList.length > 0
          ? employeeList.reduce((prev: EmployeeStats, current: EmployeeStats) =>
              (current.casesCompleted || 0) > (prev.casesCompleted || 0)
                ? current
                : prev,
            )
          : null;

      setMetrics({
        employees: employeeList,
        generatedAt: new Date().toISOString(),
        summary: {
          totalEmployees: employeeList.length,
          totalCasesProcessed: employeeList.reduce(
            (sum, emp) => sum + emp.totalCasesStarted,
            0,
          ),
          totalServedTickets,
          averageCompletionTime: employeeList.length
            ? Math.round(
                (employeeList.reduce(
                  (sum, emp) => sum + (emp.averageCaseTime || 0),
                  0,
                ) /
                  employeeList.length) *
                  100,
              ) / 100
            : null,
          highestPerformer:
            highestPerformer && highestPerformer.casesCompleted > 0
              ? highestPerformer
              : null,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatSeconds = (seconds: number | null) => {
    if (seconds === null || seconds === 0) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Performance Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading performance data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Performance Dashboard</CardTitle>
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

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Performance Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No performance data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = metrics.employees.map((emp) => ({
    name: emp.employeeName.split(" ")[0], // First name only for chart
    completed: emp.casesCompleted,
    forwarded: emp.casesProceed,
    avgTime: emp.averageCaseTime || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Employees
                </span>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">
                {metrics.summary.totalEmployees}
              </p>
              <p className="text-xs text-muted-foreground">active today</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Cases (Served Tickets) */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Cases
                </span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold">
                {metrics.summary.totalServedTickets}
              </p>
              <p className="text-xs text-muted-foreground">
                served tickets today
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Avg Completion Time */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Avg Completion
                </span>
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-3xl font-bold">
                {formatSeconds(metrics.summary.averageCompletionTime)}
              </p>
              <p className="text-xs text-muted-foreground">per case</p>
            </div>
          </CardContent>
        </Card>

        {/* Highest Performer */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Top Performer
                </span>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-sm font-bold">
                {metrics.summary.highestPerformer?.employeeName || "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {metrics.summary.highestPerformer?.casesCompleted || 0} cases
                completed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Cases Completed Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cases Completed by Employee</CardTitle>
              <CardDescription>
                Total cases completed (green) and forwarded (blue)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="#22c55e" name="Completed" />
                  <Bar dataKey="forwarded" fill="#3b82f6" name="Forwarded" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Avg Time per Case Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Average Case Duration</CardTitle>
              <CardDescription>Time spent per case by employee</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgTime"
                    stroke="#f59e0b"
                    name="Avg Time (sec)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employee Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Performance Details</CardTitle>
          <CardDescription>
            Detailed metrics for each employee (today)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.employees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No employee performance data available
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead className="text-right">Cases Started</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Forwarded</TableHead>
                    <TableHead className="text-right">Avg Time/Case</TableHead>
                    <TableHead className="text-right">Total Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.employees.map((emp) => (
                    <TableRow key={emp.employeeId}>
                      <TableCell className="font-medium">
                        {emp.employeeName}
                      </TableCell>
                      <TableCell className="text-right">
                        {emp.totalCasesStarted}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {emp.casesCompleted}
                      </TableCell>
                      <TableCell className="text-right text-blue-600 font-medium">
                        {emp.casesProceed}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatSeconds(emp.averageCaseTime)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatSeconds(emp.totalTimeSpent)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Updated timestamp */}
      <p className="text-xs text-muted-foreground text-right">
        Last updated: {format(new Date(metrics.generatedAt), "PPpp")}
      </p>
    </div>
  );
}

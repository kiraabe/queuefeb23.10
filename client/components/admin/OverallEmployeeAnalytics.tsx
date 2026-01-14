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

interface EmployeeAnalytics {
  employeeName: string;
  totalCasesStarted: number;
  casesCompleted: number;
  casesProceed: number;
  averageCaseTime: number | null;
  totalTimeSpent: number | null;
}

interface OverallAnalyticsData {
  employees: EmployeeAnalytics[];
  summary?: {
    served: number;
  };
  insights: {
    totalEmployees: number;
    totalCasesProcessed: number;
    averageCompletionTimeByEmployee: number | null;
    highestPerformer: {
      employeeName: string;
      casesCompleted: number;
      averageTime: number | null;
    } | null;
  };
  generatedAt: string;
}

export default function OverallEmployeeAnalytics() {
  const [analytics, setAnalytics] = useState<OverallAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/overall-analytics");
      if (!res.ok) {
        throw new Error("Failed to fetch overall analytics");
      }
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
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
          <CardTitle>Cases Completed by Employee (Overall)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cases Completed by Employee (Overall)</CardTitle>
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

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cases Completed by Employee (Overall)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = analytics.employees
    .filter((emp) => emp.averageCaseTime !== null) // Only show employees with time data
    .map((emp) => ({
      name: emp.employeeName.split(" ")[0], // First name only
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
                {analytics.insights.totalEmployees}
              </p>
              <p className="text-xs text-muted-foreground">with case history</p>
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
                {analytics.summary?.served || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                served tickets (all-time)
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
                  Avg Duration
                </span>
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-3xl font-bold">
                {formatSeconds(
                  analytics.employees.length > 0
                    ? Math.round(
                        analytics.employees.reduce(
                          (sum: number, emp: any) =>
                            sum + (emp.averageCaseTime || 0),
                          0,
                        ) / analytics.employees.length,
                      )
                    : null,
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                per case (average)
              </p>
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
                {analytics.insights.highestPerformer?.employeeName || "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {analytics.insights.highestPerformer?.casesCompleted || 0} cases
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
                Overall completed (green) and forwarded (blue) cases
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
              <CardDescription>
                Overall average time spent per case by employee
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis
                      label={{
                        value: "Time (seconds)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip
                      formatter={(value) => {
                        const num = Number(value);
                        const mins = Math.floor(num / 60);
                        const secs = Math.round(num % 60);
                        if (mins === 0) return `${secs}s`;
                        return `${mins}m ${secs}s`;
                      }}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgTime"
                      stroke="#f59e0b"
                      name="Avg Time"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  No duration data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employee Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Performance Summary</CardTitle>
          <CardDescription>
            Overall metrics for each employee (all-time)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.employees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No employee data available
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
                  {analytics.employees.map((emp, idx) => (
                    <TableRow key={idx}>
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
        Last updated: {format(new Date(analytics.generatedAt), "PPpp")}
      </p>
    </div>
  );
}

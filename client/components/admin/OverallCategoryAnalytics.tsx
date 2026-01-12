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
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AlertCircle, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface CategoryAnalytics {
  categoryName: string;
  totalTickets: number;
  served: number;
  skipped: number;
  transferred: number;
  averageServiceTime: number | null;
  completionRate: number;
}

interface OverallAnalyticsData {
  categories: CategoryAnalytics[];
  summary: {
    totalTickets: number;
    served: number;
    skipped: number;
    transferred: number;
    waiting: number;
    serving: number;
    completionRate: number;
    averageServiceTime: number | null;
    minServiceTime: number | null;
    maxServiceTime: number | null;
  };
  generatedAt: string;
}

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
  "#a855f7",
];

export default function OverallCategoryAnalytics() {
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
    if (mins > 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket Distribution & Category Status (Overall)</CardTitle>
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
          <CardTitle>Ticket Distribution & Category Status (Overall)</CardTitle>
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
          <CardTitle>Ticket Distribution & Category Status (Overall)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = analytics.categories.map((cat) => ({
    name: cat.categoryName,
    tickets: cat.totalTickets,
    served: cat.served,
    skipped: cat.skipped,
    transferred: cat.transferred,
  }));

  const pieData = analytics.categories.map((cat) => ({
    name: cat.categoryName,
    value: cat.totalTickets,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Tickets */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Tickets
                </span>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">
                {analytics.summary.totalTickets}
              </p>
              <p className="text-xs text-muted-foreground">all-time</p>
            </div>
          </CardContent>
        </Card>

        {/* Served */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Served
                </span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold text-green-600">
                {analytics.summary.served}
              </p>
              <p className="text-xs text-muted-foreground">completed</p>
            </div>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Completion Rate
                </span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold">
                {analytics.summary.completionRate}%
              </p>
              <p className="text-xs text-muted-foreground">overall</p>
            </div>
          </CardContent>
        </Card>

        {/* Average Service Time */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Avg Service Time
                </span>
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-3xl font-bold">
                {formatSeconds(analytics.summary.averageServiceTime)}
              </p>
              <p className="text-xs text-muted-foreground">per ticket</p>
            </div>
          </CardContent>
        </Card>

        {/* Transferred/Skipped */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Other Actions
                </span>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-3xl font-bold">
                {analytics.summary.transferred + analytics.summary.skipped}
              </p>
              <p className="text-xs text-muted-foreground">
                {analytics.summary.transferred} transferred,{" "}
                {analytics.summary.skipped} skipped
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pie Chart - Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Distribution</CardTitle>
              <CardDescription>
                Proportion of tickets by category (overall)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Chart - Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Category Status Breakdown</CardTitle>
              <CardDescription>
                Served, skipped, and transferred by category (overall)
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
                  <Bar dataKey="served" fill="#22c55e" name="Served" />
                  <Bar dataKey="skipped" fill="#f59e0b" name="Skipped" />
                  <Bar
                    dataKey="transferred"
                    fill="#3b82f6"
                    name="Transferred"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Category Table */}
      <Card>
        <CardHeader>
          <CardTitle>Category Performance Details</CardTitle>
          <CardDescription>
            Overall metrics for each service category
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.categories.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No category data available
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Served</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead className="text-right">Transferred</TableHead>
                    <TableHead className="text-right">
                      Completion Rate
                    </TableHead>
                    <TableHead className="text-right">Avg Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.categories.map((cat, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {cat.categoryName}
                      </TableCell>
                      <TableCell className="text-right">
                        {cat.totalTickets}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {cat.served}
                      </TableCell>
                      <TableCell className="text-right text-orange-600 font-medium">
                        {cat.skipped}
                      </TableCell>
                      <TableCell className="text-right text-blue-600 font-medium">
                        {cat.transferred}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold">
                          {cat.completionRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatSeconds(cat.averageServiceTime)}
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

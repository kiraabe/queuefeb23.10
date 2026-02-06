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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  Users,
} from "lucide-react";

interface ServiceCategoryStats {
  category: string;
  totalTickets: number;
  served: number;
  skipped: number;
  transferred: number;
  averageServiceTime: number | null;
  completionRate: number;
  services: Array<{
    name: string;
    total: number;
    served: number;
  }>;
}

interface Analytics {
  categories: ServiceCategoryStats[];
  summary: {
    totalCategories: number;
    overallCompletionRate: number;
    averageServiceTime: number | null;
    topCategory: ServiceCategoryStats | null;
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
];

export default function ServiceCategoryAnalytics() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const reportRes = await fetch("/api/admin/daily-report");
      if (!reportRes.ok) {
        throw new Error("Failed to fetch daily report");
      }
      const reportData = await reportRes.json();

      // Group tickets by service category
      const categoryMap = new Map<string, ServiceCategoryStats>();

      for (const ticket of reportData.allTickets) {
        const category = ticket.service || "Uncategorized";

        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            totalTickets: 0,
            served: 0,
            skipped: 0,
            transferred: 0,
            averageServiceTime: null,
            completionRate: 0,
            services: [],
          });
        }

        const stats = categoryMap.get(category)!;
        stats.totalTickets++;

        if (ticket.status === "done") {
          stats.served++;
        } else if (ticket.status === "skipped") {
          stats.skipped++;
        } else if (ticket.status === "transferred") {
          stats.transferred++;
        }
      }

      // Calculate completion rates and average times
      const categories = Array.from(categoryMap.values())
        .map((cat) => {
          // Calculate average service time for tickets with both started_at and completed_at
          const ticketsWithTiming = reportData.allTickets
            .filter(
              (t) => t.service === cat.category && t.startedAt && t.completedAt,
            )
            .map((t) => (t.completedAt - t.startedAt) / 1000); // Convert to seconds

          const avgServiceTime =
            ticketsWithTiming.length > 0
              ? ticketsWithTiming.reduce((a, b) => a + b, 0) /
                ticketsWithTiming.length
              : null;

          return {
            ...cat,
            averageServiceTime: avgServiceTime,
            completionRate:
              cat.totalTickets > 0
                ? Math.round((cat.served / cat.totalTickets) * 100)
                : 0,
          };
        })
        .sort((a, b) => b.totalTickets - a.totalTickets);

      // Find top category
      const topCategory = categories.length > 0 ? categories[0] : null;

      // Calculate overall stats
      const totalTickets = categories.reduce(
        (sum, cat) => sum + cat.totalTickets,
        0,
      );
      const totalServed = categories.reduce((sum, cat) => sum + cat.served, 0);
      const overallCompletionRate =
        totalTickets > 0 ? Math.round((totalServed / totalTickets) * 100) : 0;

      // Get average service time from report summary
      const averageServiceTime = reportData.summary.averageServiceTime;

      setAnalytics({
        categories,
        summary: {
          totalCategories: categories.length,
          overallCompletionRate,
          averageServiceTime,
          topCategory,
        },
        generatedAt: new Date().toISOString(),
      });
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
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}hr ${minutes}min ${secs}sec`;
    } else if (minutes > 0) {
      return `${minutes}min ${secs}sec`;
    } else {
      return `${secs}sec`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Category Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading analytics data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Category Analytics</CardTitle>
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
          <CardTitle>Service Category Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = analytics.categories.map((cat) => ({
    name: cat.category,
    tickets: cat.totalTickets,
    served: cat.served,
    skipped: cat.skipped,
    transferred: cat.transferred,
  }));

  const pieData = analytics.categories.map((cat) => ({
    name: cat.category,
    value: cat.totalTickets,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Categories */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Categories
                </span>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-3xl font-bold">
                {analytics.summary.totalCategories}
              </p>
              <p className="text-xs text-muted-foreground">active categories</p>
            </div>
          </CardContent>
        </Card>

        {/* Overall Completion Rate */}
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
                {analytics.summary.overallCompletionRate}%
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

        {/* Top Category */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Top Category
                </span>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-sm font-bold">
                {analytics.summary.topCategory?.category || "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {analytics.summary.topCategory?.totalTickets || 0} tickets
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
                Proportion of tickets by category
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

          {/* Bar Chart - Completion Status */}
          <Card>
            <CardHeader>
              <CardTitle>Category Status Breakdown</CardTitle>
              <CardDescription>
                Served, skipped, and transferred by category
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
            Detailed metrics for each service category
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
                  {analytics.categories.map((cat) => (
                    <TableRow key={cat.category}>
                      <TableCell className="font-medium">
                        {cat.category}
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
    </div>
  );
}

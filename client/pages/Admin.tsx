import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Users,
  Ticket,
  MonitorPlay,
  Settings,
  User,
  Briefcase,
  TrendingUp,
  Search,
  Zap,
} from "lucide-react";
import AdminDashboard from "@/components/admin/AdminDashboard";
import SessionManagement from "@/components/admin/SessionManagement";
import TicketManagement from "@/components/admin/TicketManagement";
import AdminWindows from "@/components/admin/AdminWindows";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminProfile from "@/components/admin/AdminProfile";
import EmploymentManagement from "@/components/admin/EmploymentManagement";
import EmployeePerformanceDashboard from "@/components/admin/EmployeePerformanceDashboard";
import CaseWorkflowTracker from "@/components/admin/CaseWorkflowTracker";
import EmployeeCaseQueue from "@/components/admin/EmployeeCaseQueue";
import ServiceCategoryAnalytics from "@/components/admin/ServiceCategoryAnalytics";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage system operations, monitor queues, and configure settings
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full gap-1 grid-cols-3 sm:grid-cols-4 lg:grid-cols-11 h-auto p-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Employees</span>
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Workflow</span>
            </TabsTrigger>
            <TabsTrigger value="cases" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Cases</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Services</span>
            </TabsTrigger>
            <TabsTrigger value="employment" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Employment</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Sessions</span>
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Tickets</span>
            </TabsTrigger>
            <TabsTrigger value="windows" className="flex items-center gap-2">
              <MonitorPlay className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Windows</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Profile</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <AdminDashboard />
          </TabsContent>

          <TabsContent value="employment" className="space-y-4">
            <EmploymentManagement />
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <SessionManagement />
          </TabsContent>

          <TabsContent value="tickets" className="space-y-4">
            <TicketManagement />
          </TabsContent>

          <TabsContent value="windows" className="space-y-4">
            <AdminWindows />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <AdminSettings />
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <AdminProfile />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

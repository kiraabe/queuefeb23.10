import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Users,
  Ticket,
  MonitorPlay,
  Settings,
  User,
  Briefcase,
} from "lucide-react";
import MobileAdminLayout from "@/components/admin/MobileAdminLayout";
import AdminDashboard from "@/components/admin/AdminDashboard";
import SessionManagement from "@/components/admin/SessionManagement";
import TicketManagement from "@/components/admin/TicketManagement";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminProfile from "@/components/admin/AdminProfile";
import EmploymentManagement from "@/components/admin/EmploymentManagement";
import AdminWindows from "@/components/admin/AdminWindows";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1026);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1026);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <BarChart3 className="h-5 w-5" />,
      onClick: () => setActiveTab("dashboard"),
    },
    {
      id: "employment",
      label: "Employment",
      icon: <Briefcase className="h-5 w-5" />,
      onClick: () => setActiveTab("employment"),
    },
    {
      id: "sessions",
      label: "Sessions",
      icon: <Users className="h-5 w-5" />,
      onClick: () => setActiveTab("sessions"),
    },
    {
      id: "tickets",
      label: "Tickets",
      icon: <Ticket className="h-5 w-5" />,
      onClick: () => setActiveTab("tickets"),
    },
    {
      id: "windows",
      label: "Windows",
      icon: <MonitorPlay className="h-5 w-5" />,
      onClick: () => setActiveTab("windows"),
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="h-5 w-5" />,
      onClick: () => setActiveTab("settings"),
    },
    {
      id: "profile",
      label: "Profile",
      icon: <User className="h-5 w-5" />,
      onClick: () => setActiveTab("profile"),
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <AdminDashboard />;
      case "employment":
        return <EmploymentManagement />;
      case "sessions":
        return <SessionManagement />;
      case "tickets":
        return <TicketManagement />;
      case "windows":
        return <AdminWindows />;
      case "settings":
        return <AdminSettings />;
      case "profile":
        return <AdminProfile />;
      default:
        return <AdminDashboard />;
    }
  };

  // Mobile/Tablet layout
  if (!isDesktop) {
    return (
      <MobileAdminLayout navItems={navItems} activeTab={activeTab}>
        {renderContent()}
      </MobileAdminLayout>
    );
  }

  // Desktop layout with tabs
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
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="employment" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Employment</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Sessions</span>
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              <span className="hidden sm:inline">Tickets</span>
            </TabsTrigger>
            <TabsTrigger value="windows" className="flex items-center gap-2">
              <MonitorPlay className="h-4 w-4" />
              <span className="hidden sm:inline">Windows</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
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

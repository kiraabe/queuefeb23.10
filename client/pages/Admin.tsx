import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import AdminFooter from "@/components/admin/AdminFooter";

export default function Admin() {
  // Triple-check: Env Key == Entered Key == DB Key is required for initial activation.
  // Once activated, the host is bound in the database and this page will load automatically.
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
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
      <TooltipProvider>
        <MobileAdminLayout navItems={navItems} activeTab={activeTab}>
          {renderContent()}
        </MobileAdminLayout>
      </TooltipProvider>
    );
  }

  // Desktop layout with tabs and footer
  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 container mx-auto px-4 py-6 pb-12">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
              <p className="text-muted-foreground">
                Manage system operations, monitor queues, and configure settings
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex h-11 w-full items-stretch justify-start gap-1 rounded-[16px] bg-muted/50 p-1 shadow-inner">
                {navItems.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="group flex flex-1 items-center justify-center gap-2.5 rounded-[12px] py-0 px-4 transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-lg data-[state=active]:ring-1 data-[state=active]:ring-black/5 hover:bg-muted/60"
                  >
                    <span className="h-5 w-5 opacity-70 transition-opacity duration-200 group-data-[state=active]:opacity-100">
                      {item.icon}
                    </span>
                    <span className="font-semibold tracking-tight">{item.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {navItems.map((item) => (
                <TabsContent key={item.id} value={item.id} className="mt-8 space-y-4 focus-visible:outline-none ring-offset-background">
                  {renderContent()}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
        <AdminFooter />
      </div>
    </TooltipProvider>
  );
}

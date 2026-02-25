import { useState } from "react";
import {
  BarChart3,
  Users,
  Ticket,
  MonitorPlay,
  Settings,
  User,
  Briefcase,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/components/admin/AdminDashboard";
import SessionManagement from "@/components/admin/SessionManagement";
import TicketManagement from "@/components/admin/TicketManagement";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminProfile from "@/components/admin/AdminProfile";
import EmploymentManagement from "@/components/admin/EmploymentManagement";
import AdminWindows from "@/components/admin/AdminWindows";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("dashboard");

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

  return (
    <AdminLayout navItems={navItems} activeTab={activeTab}>
      {renderContent()}
    </AdminLayout>
  );
}

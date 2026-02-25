import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  Ticket,
  MonitorPlay,
  Settings,
  User,
  Briefcase,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

interface MobileAdminLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  activeTab: string;
}

export default function MobileAdminLayout({
  children,
  navItems,
  activeTab,
}: MobileAdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filter nav items for mobile bottom nav
  const mobileNavItems = navItems.slice(0, 5); // Dashboard, Employment, Sessions, Tickets, Windows

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Mobile/Tablet Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4 bg-background">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">Management System</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Tablet Collapsible Sidebar */}
      {sidebarOpen && (
        <div className="absolute inset-0 z-40 block">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative h-full w-64 bg-background border-r border-border flex flex-col z-50">
            <div className="flex h-16 items-center justify-between px-6 border-b border-border">
              <h1 className="text-lg font-bold tracking-tight">Navigation</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-col gap-1 p-4 overflow-y-auto flex-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onClick();
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className="h-5 w-5 flex-shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        <div className="mx-auto w-full px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around border-t border-border bg-background/95 backdrop-blur-sm lg:hidden safe-area-bottom">
        {mobileNavItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-200 active:scale-95",
              activeTab === item.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="h-6 w-6 transition-transform duration-200">
              {item.icon}
            </span>
            <span className="text-xs font-medium text-center line-clamp-1 leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

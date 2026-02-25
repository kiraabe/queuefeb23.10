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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
}

interface AdminLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  activeTab: string;
}

export default function AdminLayout({
  children,
  navItems,
  activeTab,
}: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border transition-all duration-300">
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          <h1 className="text-lg font-bold tracking-tight">Admin</h1>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                activeTab === item.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="h-5 w-5 flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden animate-fadeInUp">
          <div
            className="absolute inset-0 bg-black/50 transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative h-full w-64 bg-background border-r border-border flex flex-col slide-in-left">
            <div className="flex h-16 items-center justify-between px-6 border-b border-border">
              <h1 className="text-lg font-bold tracking-tight">Admin</h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-col gap-1 p-4 overflow-y-auto">
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
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="flex h-14 sm:h-16 items-center justify-between border-b border-border px-4 sm:px-6 lg:hidden bg-background">
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">Admin Panel</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="transition-transform duration-200 hover:scale-110"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Desktop Top Bar */}
        <div className="hidden lg:flex h-16 items-center justify-between border-b border-border px-6 bg-gradient-to-r from-background to-background">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage system operations, monitor queues, and configure settings
            </p>
          </div>
        </div>

        {/* Content Area with Padding for Bottom Nav on Mobile */}
        <div className="flex-1 overflow-y-auto pb-20 lg:pb-0 scroll-smooth">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around border-t border-border bg-background/95 backdrop-blur-sm lg:hidden safe-area-bottom">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-200 hover:scale-110 active:scale-95",
              activeTab === item.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="h-6 w-6 transition-transform duration-200">{item.icon}</span>
            <span className="text-xs font-medium text-center line-clamp-1 leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

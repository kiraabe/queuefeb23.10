import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ProfileDropdown } from "./ProfileDropdown";

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
        <ProfileDropdown navItems={navItems} />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto md:pb-0" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
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

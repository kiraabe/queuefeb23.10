import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface ProfileDropdownProps {
  navItems: NavItem[];
}

export function ProfileDropdown({ navItems }: ProfileDropdownProps) {
  const { user, logout } = useAuth();

  const settingsItem = navItems.find((item) => item.id === "settings");
  const profileItem = navItems.find((item) => item.id === "profile");

  const initials = user?.username?.slice(0, 2).toUpperCase() || "AD";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-10 w-10 rounded-full outline-none ring-offset-background transition-all hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-10 w-10 border border-border shadow-sm">
            <AvatarImage src="" alt={user?.username || "Admin"} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.username || "Admin User"}</p>
            <p className="text-xs leading-none text-muted-foreground capitalize">
              {user?.role || "Administrator"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileItem && (
          <DropdownMenuItem onClick={profileItem.onClick} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
        )}
        {settingsItem && (
          <DropdownMenuItem onClick={settingsItem.onClick} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

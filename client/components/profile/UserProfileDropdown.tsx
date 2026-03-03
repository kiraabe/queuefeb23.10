import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, ChevronDown, Globe } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, Language, LANGUAGE_LABELS } from "@/hooks/use-language";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function UserProfileDropdown() {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success("Signed out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to sign out");
      setIsLoggingOut(false);
    }
  };

  // Get user initials for avatar fallback
  const getInitials = (fullName?: string, username?: string): string => {
    const name = fullName || username;
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = getInitials(user.fullName, user.username);
  const isReception = user.role === "reception";

  // For reception users, show simplified dropdown with just language and logout
  if (isReception) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 px-2 h-10"
            aria-label="User menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-1.5 py-2">
            <p className="font-semibold text-sm leading-none">
              {user.fullName || user.username}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {user.role}
            </p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Globe className="h-4 w-4 mr-2" />
              <span>Language</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {Object.entries(LANGUAGE_LABELS).map(([lang, label]) => (
                <DropdownMenuItem
                  key={lang}
                  onSelect={() => setLanguage(lang as Language)}
                  className={language === lang ? "bg-accent" : ""}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={handleLogout}
            disabled={isLoggingOut}
            className="text-red-600 dark:text-red-400 cursor-pointer"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span>{isLoggingOut ? "Signing out..." : "Sign out"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // For other roles, show full dropdown menu with profile option
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 px-2 h-10"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start gap-0.5">
            <span className="text-sm font-medium leading-none truncate max-w-[150px]">
              {user.fullName || user.username}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {user.role}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1.5 py-2">
          <p className="font-semibold text-sm leading-none">
            {user.fullName || user.username}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {user.role}
          </p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => navigate("/profile")}>
            <User className="h-4 w-4 mr-2" />
            <span>My Profile</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe className="h-4 w-4 mr-2" />
            <span>Language</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {Object.entries(LANGUAGE_LABELS).map(([lang, label]) => (
              <DropdownMenuItem
                key={lang}
                onSelect={() => setLanguage(lang as Language)}
                className={language === lang ? "bg-accent" : ""}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={handleLogout}
          disabled={isLoggingOut}
          className="text-red-600 dark:text-red-400 cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span>{isLoggingOut ? "Signing out..." : "Sign out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

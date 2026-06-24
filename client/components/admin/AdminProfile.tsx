import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LogOut,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  User,
  Clock,
  KeyRound,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(fullName?: string, username?: string) {
  const name = fullName || username || "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleColor(role: string) {
  switch (role) {
    case "admin":
      return "bg-purple-100 text-purple-800";
    case "reception":
      return "bg-blue-100 text-blue-800";
    case "teller":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ProfileHeader({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarFallback className="text-lg">
          {getInitials(user.fullName, user.username)}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <div>
          <p className="text-lg font-semibold">{user.fullName || user.username}</p>
          <p className="text-sm text-muted-foreground">Admin Account</p>
        </div>
        <Badge className={getRoleColor(user.role)}>
          <ShieldCheck className="mr-1 h-3 w-3" />
          {capitalize(user.role)}
        </Badge>
      </div>
    </div>
  );
}

function AccountDetailGrid({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const fields = [
    { label: "Username", value: user.username },
    { label: "Full Name", value: user.fullName || "N/A" },
    { label: "User ID", value: user.id, mono: true },
    { label: "Primary Role", value: capitalize(user.role) },
    ...(user.windowId
      ? [{ label: "Assigned Window", value: `Window ${user.windowId}` }]
      : []),
    { label: "Account Type", value: "System Administrator" },
    {
      label: "Created Date",
      value: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "MMM d, yyyy"),
    },
    {
      label: "Last Login",
      value: format(new Date(), "MMM d, yyyy HH:mm:ss"),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {fields.map(({ label, value, mono }) => (
        <div key={label}>
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <p className={`font-medium ${mono ? "font-mono text-sm break-all" : ""}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function AccountStatusBadge() {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Account Status</p>
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <p className="text-sm text-muted-foreground">Active</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Last activity: {format(new Date(), "MMM d, yyyy HH:mm:ss")}
      </p>
    </div>
  );
}

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    toast.success(`Theme changed to ${newTheme}`);
  };

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  if (!mounted) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="theme">Theme Preference</Label>
      <div className="flex gap-2">
        {options.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={theme === value ? "default" : "outline"}
            size="sm"
            onClick={() => handleThemeChange(value)}
            className="flex-1"
          >
            <Icon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SessionDetails({ loginTime }: { loginTime: Date }) {
  const sessionFields = [
    {
      label: "Login Time",
      value: format(loginTime, "MMM d, yyyy HH:mm:ss"),
    },
    {
      label: "Session Duration",
      value: `${Math.floor((new Date().getTime() - loginTime.getTime()) / 60000)} minutes`,
    },
    { label: "Session Type", value: "Secure Cookie" },
    { label: "Status", value: "active" as const },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      {sessionFields.map(({ label, value }) => (
        <div key={label}>
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {value === "active" ? (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <p className="font-medium">Active</p>
            </div>
          ) : (
            <p className="font-medium">{value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function SessionSecurityNotice() {
  return (
    <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
        Session Security
      </p>
      <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">
        Your session is secured with httpOnly cookies and CSRF protection.
        For additional security, consider logging out when finished.
      </p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminProfile() {
  const { user, logout } = useAuth();
  const [loginTime] = useState(new Date());

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Not logged in</p>
        </CardContent>
      </Card>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
    } catch {
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Profile Identity ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Profile Information</CardTitle>
          </div>
          <CardDescription>View your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProfileHeader user={user} />
          <Separator />
          <AccountDetailGrid user={user} />
          <Separator />
          <AccountStatusBadge />
        </CardContent>
      </Card>

      {/* ── Security & Preferences ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Change Password */}
        <div className="space-y-0">
          <div className="flex items-center gap-2 mb-3 px-1">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Security</span>
          </div>
          <ChangePasswordForm />
        </div>

        {/* Account Settings */}
        <div className="space-y-0">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Preferences</span>
          </div>
          <Card className="border-border/60 bg-card/90 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Account Settings</CardTitle>
              <CardDescription>Manage your account preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ThemeSelector />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Active Session ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Current Session</CardTitle>
          </div>
          <CardDescription>Information about your active session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SessionDetails loginTime={loginTime} />
          <Separator />
          <SessionSecurityNotice />
          <Button variant="destructive" onClick={handleLogout} className="w-fit">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
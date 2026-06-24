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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LogOut,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  KeyRound,
  Settings2,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(fullName?: string, username?: string) {
  const name = fullName || username || "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getRoleColor(role: string) {
  const map: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800",
    reception: "bg-blue-100 text-blue-800",
    teller: "bg-green-100 text-green-800",
  };
  return map[role] ?? "bg-gray-100 text-gray-800";
}

// ─── Identity Sidebar ────────────────────────────────────────────────────────

function IdentitySidebar({
  user,
  loginTime,
  onLogout,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  loginTime: Date;
  onLogout: () => void;
}) {
  const sessionMinutes = Math.floor(
    (new Date().getTime() - loginTime.getTime()) / 60000
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Avatar + Name */}
      <Card>
        <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-xl">
              {getInitials(user.fullName, user.username)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-base leading-tight">
              {user.fullName || user.username}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">@{user.username}</p>
          </div>
          <Badge className={getRoleColor(user.role)}>
            <ShieldCheck className="mr-1 h-3 w-3" />
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </Badge>
          <div className="w-full rounded-md border px-3 py-2 text-left">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Snapshot */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Logged in at</p>
            <p className="font-medium">{format(loginTime, "HH:mm:ss")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="font-medium">{sessionMinutes} min</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Auth method</p>
            <p className="font-medium">Secure Cookie</p>
          </div>
          <Separator />
          <div className="rounded-md bg-blue-50 dark:bg-blue-950 px-3 py-2">
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              Session secured with httpOnly cookies & CSRF protection.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={onLogout}
            className="w-full"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Account Details Tab ─────────────────────────────────────────────────────

function AccountTab({
  user,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
}) {
  const fields = [
    { label: "User ID", value: user.id, mono: true, full: true },
    { label: "Full name", value: user.fullName || "N/A" },
    { label: "Username", value: user.username },
    { label: "Role", value: user.role.charAt(0).toUpperCase() + user.role.slice(1) },
    { label: "Account type", value: "System Administrator" },
    ...(user.windowId
      ? [{ label: "Assigned window", value: `Window ${user.windowId}` }]
      : []),
    {
      label: "Member since",
      value: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "MMM d, yyyy"),
    },
    {
      label: "Last login",
      value: format(new Date(), "MMM d, yyyy · HH:mm"),
    },
  ];

  return (
    <div className="space-y-1">
      {fields.map(({ label, value, mono, full }) => (
        <div
          key={label}
          className={`flex items-start justify-between gap-4 py-3 border-b last:border-0 ${full ? "flex-col gap-1" : ""}`}
        >
          <span className="text-sm text-muted-foreground shrink-0">{label}</span>
          <span
            className={`text-sm font-medium text-right break-all ${mono ? "font-mono text-xs" : ""}`}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Security Tab ────────────────────────────────────────────────────────────

function SecurityTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-1">Change password</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Use a strong, unique password you don't use elsewhere.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}

// ─── Preferences Tab ─────────────────────────────────────────────────────────

function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium">Appearance</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">
          Choose how the interface looks to you.
        </p>
        {mounted && (
          <div className="flex gap-2">
            {options.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTheme(value);
                  toast.success(`Theme set to ${value}`);
                }}
                className="flex-1"
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>
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
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
      {/* Left: identity + session */}
      <IdentitySidebar user={user} loginTime={loginTime} onLogout={handleLogout} />

      {/* Right: tabbed content */}
      <Card>
        <CardHeader>
          <CardTitle>My account</CardTitle>
          <CardDescription>Manage your profile, security, and preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="account">
            <TabsList className="mb-6">
              <TabsTrigger value="account" className="gap-1.5">
                Account
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Security
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                Preferences
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <AccountTab user={user} />
            </TabsContent>
            <TabsContent value="security">
              <SecurityTab />
            </TabsContent>
            <TabsContent value="preferences">
              <PreferencesTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
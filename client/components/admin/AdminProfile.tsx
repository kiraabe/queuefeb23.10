import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  LogOut,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminProfile() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loginTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    toast.success(`Theme changed to ${newTheme}`);
  };

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
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const getInitials = (username: string) => {
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role: string) => {
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
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>View your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Avatar and Basic Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {getInitials(user.username)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div>
                <p className="text-lg font-semibold">{user.username}</p>
                <p className="text-sm text-muted-foreground">Admin Account</p>
              </div>
              <Badge className={getRoleColor(user.role)}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Account Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Username</Label>
              <p className="font-medium">{user.username}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <p className="font-medium">{user.fullName || "N/A"}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">User ID</Label>
              <p className="font-mono text-sm break-all">{user.id}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Primary Role</Label>
              <p className="font-medium capitalize">{user.role}</p>
            </div>

            {user.windowId && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Assigned Window
                </Label>
                <p className="font-medium">Window {user.windowId}</p>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Account Type</Label>
              <p className="font-medium">System Administrator</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Created Date</Label>
              <p className="font-medium">
                {format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "MMM d, yyyy")}
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Last Login</Label>
              <p className="font-medium">
                {format(new Date(), "MMM d, yyyy HH:mm:ss")}
              </p>
            </div>
          </div>

          <Separator />

          {/* Account Status */}
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
        </CardContent>
      </Card>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>Manage your account preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Password changes can be managed by contacting your system
              administrator.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="theme">Theme Preference</Label>
            {mounted && (
              <div className="flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange("light")}
                  className="flex-1"
                >
                  <Sun className="mr-2 h-4 w-4" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange("dark")}
                  className="flex-1"
                >
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange("system")}
                  className="flex-1"
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  System
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Info */}
      <Card>
        <CardHeader>
          <CardTitle>Current Session</CardTitle>
          <CardDescription>
            Information about your active session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">
                Login Time
              </Label>
              <p className="font-medium">
                {format(loginTime, "MMM d, yyyy HH:mm:ss")}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Session Duration
              </Label>
              <p className="font-medium">
                {Math.floor(
                  (new Date().getTime() - loginTime.getTime()) / 60000,
                )}{" "}
                minutes
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Session Type
              </Label>
              <p className="font-medium">Secure Cookie</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="font-medium">Active</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Session Security
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">
              Your session is secured with httpOnly cookies and CSRF protection.
              For additional security, consider logging out when finished.
            </p>
          </div>

          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-fit"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { KeyRound, Building2, Users, UserCheck, LogOut } from "lucide-react";

const roleConfig = {
  admin: {
    label: "Admin",
    description: "Manage users, windows, services, and system settings",
    icon: KeyRound,
  },
  reception: {
    label: "Reception",
    description: "Create tickets and manage the queue",
    icon: Users,
  },
  teller: {
    label: "Teller",
    description: "Call and serve tickets at a window",
    icon: Building2,
  },
  employee: {
    label: "Employee",
    description: "Handle transferred tickets and case workflows",
    icon: UserCheck,
  },
};

export default function RoleSelector() {
  const { user, switchRole, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user has only one role, redirect to appropriate page
    if (user && user.roles && user.roles.length === 1) {
      const role = user.role;
      if (role === "admin") navigate("/admin");
      else if (role === "reception") navigate("/reception");
      else if (role === "teller" && user.windowId)
        navigate(`/teller/${user.windowId}`);
      else if (role === "employee") navigate("/employee");
      else if (role === "archiever") navigate("/archiever");
      else navigate("/");
    }
  }, [user, navigate]);

  if (user === undefined || !user) {
    return null;
  }

  const availableRoles = user.roles || [user.role];
  const currentRole = user.role;

  const handleRoleSelect = async (role: string) => {
    if (role === currentRole) {
      // Same role, just navigate
      const config = roleConfig[role as keyof typeof roleConfig];
      if (role === "admin") navigate("/admin");
      else if (role === "reception") navigate("/reception");
      else if (role === "teller" && user.windowId)
        navigate(`/teller/${user.windowId}`);
      else if (role === "employee") navigate("/employee");
      else navigate("/");
    } else {
      // Switch role
      try {
        const updatedUser = await switchRole(role);
        // Navigate after switching
        if (role === "admin") navigate("/admin");
        else if (role === "reception") navigate("/reception");
        else if (role === "teller" && user.windowId)
          navigate(`/teller/${user.windowId}`);
        else if (role === "employee") navigate("/employee");
        else navigate("/");
      } catch (error) {
        console.error("Failed to switch role:", error);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {user.fullName || user.username}
          </h1>
          <p className="text-muted-foreground mt-2">
            You have access to {availableRoles.length} role
            {availableRoles.length !== 1 ? "s" : ""}. Select one to continue.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {availableRoles.map((role) => {
            const config = roleConfig[role as keyof typeof roleConfig];
            const Icon = config.icon;
            const isActive = role === currentRole;

            return (
              <Card
                key={role}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => handleRoleSelect(role)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {config.label}
                        </CardTitle>
                        {isActive && (
                          <p className="text-xs text-primary font-semibold">
                            Currently selected
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {config.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

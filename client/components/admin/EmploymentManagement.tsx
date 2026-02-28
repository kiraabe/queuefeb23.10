import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Trash2,
  Plus,
  Edit2,
  X,
  Check,
  Badge,
  Key,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import type {
  UserInfo,
  ListUsersResponse,
  CreateUserResponse,
  UpdateUserResponse,
  WindowInfo,
  ListWindowsResponse,
  JobTitle,
  ListJobTitlesResponse,
} from "@shared/api";

export default function EmploymentManagement() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<
    "all" | "reception" | "teller" | "admin" | "employee" | "archiever"
  >("all");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const EMPLOYEES_PER_PAGE = 18; // 3 columns x 6 rows

  // Edit form state
  const [editingUsername, setEditingUsername] = useState("");
  const [editingFullName, setEditingFullName] = useState("");
  const [editingDepartment, setEditingDepartment] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [editingJobTitleId, setEditingJobTitleId] = useState("");
  const [editingWindowId, setEditingWindowId] = useState<number | null>(null);
  const [editingRole, setEditingRole] = useState<
    "reception" | "teller" | "admin" | "employee" | "archiever"
  >("teller");
  const [editingDisabled, setEditingDisabled] = useState(false);

  // Reset password state
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(
    null,
  );
  const [resetPasswordData, setResetPasswordData] = useState<{
    username: string;
    password: string;
  } | null>(null);

  // New employee form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<
    "reception" | "teller" | "admin" | "employee" | "archiever"
  >("teller");
  const [newFullName, setNewFullName] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newJobTitleId, setNewJobTitleId] = useState("");
  const [newWindowId, setNewWindowId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [usersRes, windowsRes, jobTitlesRes] = await Promise.all([
        fetch("/api/admin/users", {
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }),
        fetch("/api/admin/windows", {
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }),
        fetch("/api/admin/job-titles", {
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }),
      ]);

      if (!usersRes.ok) {
        const errorData = await usersRes.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Users API failed: ${usersRes.status}`,
        );
      }

      if (!windowsRes.ok) {
        const errorData = await windowsRes.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Windows API failed: ${windowsRes.status}`,
        );
      }

      if (!jobTitlesRes.ok) {
        const errorData = await jobTitlesRes.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Job titles API failed: ${jobTitlesRes.status}`,
        );
      }

      const usersData: ListUsersResponse = await usersRes.json();
      const windowsData: ListWindowsResponse = await windowsRes.json();
      const jobTitlesData: ListJobTitlesResponse = await jobTitlesRes.json();

      setUsers(usersData.users);
      setWindows(windowsData.windows);
      setJobTitles(jobTitlesData.jobTitles);
    } catch (error) {
      console.error("Failed to load data", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredUsers = () => {
    if (roleFilter === "all") return users;
    return users.filter((u) => u.role === roleFilter);
  };

  const getWindowName = (windowId: number | null) => {
    if (!windowId) return "Unassigned";
    return windows.find((w) => w.id === windowId)?.name || `Window ${windowId}`;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "teller":
        return "bg-blue-100 text-blue-800";
      case "reception":
        return "bg-green-100 text-green-800";
      case "employee":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleAddEmployee = async () => {
    const username = newUsername.trim().toLowerCase();
    const fullName = newFullName.trim();
    const department = newDepartment.trim();
    const email = newEmail.trim();
    const phone = newPhone.trim();

    if (!username) {
      toast.error("Username is required");
      return;
    }

    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    // Password required for non-teller roles
    if (newRole !== "teller" && !newPassword) {
      toast.error("Password is required for this role");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          username,
          password: newPassword || undefined,
          role: newRole,
          windowId: newRole === "teller" ? newWindowId : null,
          fullName: fullName || undefined,
          department: department || undefined,
          email: email || undefined,
          phone: phone || undefined,
          jobTitleId: newJobTitleId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create employee");
      }

      const data: CreateUserResponse = await response.json();
      setUsers([...users, data.user]);

      // Reset form
      setNewUsername("");
      setNewPassword("");
      setNewRole("teller");
      setNewFullName("");
      setNewDepartment("");
      setNewEmail("");
      setNewPhone("");
      setNewJobTitleId("");
      setNewWindowId(null);
      setShowAddForm(false);

      toast.success("Employee created successfully");
    } catch (error) {
      console.error("Failed to create employee", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create employee",
      );
    }
  };

  const handleEditEmployee = (user: UserInfo) => {
    setEditingUserId(user.id);
    setEditingUsername(user.username);
    setEditingFullName(user.fullName || "");
    setEditingDepartment(user.department || "");
    setEditingEmail(user.email || "");
    setEditingPhone(user.phone || "");
    setEditingJobTitleId(user.jobTitleId || "");
    setEditingWindowId(user.windowId || null);
    setEditingRole(user.role as "reception" | "teller" | "admin");
    setEditingDisabled(user.disabled || false);
  };

  const handleSaveEdit = async (userId: string) => {
    const username = editingUsername.trim().toLowerCase();
    const fullName = editingFullName.trim();
    const department = editingDepartment.trim();
    const email = editingEmail.trim();
    const phone = editingPhone.trim();

    if (!username) {
      toast.error("Username is required");
      return;
    }

    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          username,
          role: editingRole,
          windowId: editingRole === "teller" ? editingWindowId : null,
          disabled: editingDisabled,
          fullName: fullName || undefined,
          department: department || undefined,
          email: email || undefined,
          phone: phone || undefined,
          jobTitleId: editingJobTitleId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update employee");
      }

      const data: UpdateUserResponse = await response.json();
      setUsers(users.map((u) => (u.id === userId ? data.user : u)));
      setEditingUserId(null);

      toast.success("Employee updated successfully");
    } catch (error) {
      console.error("Failed to update employee", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update employee",
      );
    }
  };

  const handleDeleteEmployee = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    if (
      !confirm(
        `Are you sure you want to delete employee "${user.username}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete employee");
      }

      setUsers(users.filter((u) => u.id !== userId));
      toast.success("Employee deleted successfully");
    } catch (error) {
      console.error("Failed to delete employee", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete employee",
      );
    }
  };

  const handleResetPassword = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    try {
      const response = await fetch(
        `/api/admin/users/${userId}/reset-password`,
        {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }

      const data = await response.json();
      setResetPasswordUserId(userId);
      setResetPasswordData({
        username: user.username,
        password: data.password,
      });

      toast.success("Password reset successfully");
    } catch (error) {
      console.error("Failed to reset password", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reset password",
      );
    }
  };

  const downloadEmployeePassword = (username: string, password: string) => {
    const content = `Username: ${username}\nPassword: ${password}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${username}-credentials.txt`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
    toast.success("Password downloaded");
  };

  const filteredUsers = getFilteredUsers();

  // Reset to page 1 when filter changes
  const handleRoleFilterChange = (
    role: "all" | "reception" | "teller" | "admin" | "employee" | "archiever",
  ) => {
    setRoleFilter(role);
    setCurrentPage(1);
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredUsers.length / EMPLOYEES_PER_PAGE);
  const startIndex = (currentPage - 1) * EMPLOYEES_PER_PAGE;
  const endIndex = startIndex + EMPLOYEES_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Filter and Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Employment Management</CardTitle>
              <CardDescription>
                Manage employees across all roles and departments
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(
              [
                "all",
                "reception",
                "teller",
                "admin",
                "employee",
                "archiever",
              ] as const
            ).map((role) => (
              <Button
                key={role}
                variant={roleFilter === role ? "default" : "outline"}
                onClick={() => handleRoleFilterChange(role)}
                className="capitalize"
              >
                {role === "all" ? "All Employees" : role}
                {role !== "all" && (
                  <span className="ml-1 text-xs font-normal">
                    ({users.filter((u) => u.role === role).length})
                  </span>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Employee Form */}
      {showAddForm && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base">Add New Employee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-username">Username *</Label>
                <Input
                  id="new-username"
                  placeholder="john_doe"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-role">Role *</Label>
                <Select
                  value={newRole}
                  onValueChange={(value) =>
                    setNewRole(
                      value as
                        | "reception"
                        | "teller"
                        | "admin"
                        | "employee"
                        | "archiever",
                    )
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reception">Reception</SelectItem>
                    <SelectItem value="teller">Teller</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="archiever">Archiever</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newRole !== "teller" && (
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password *</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-fullName">Full Name</Label>
                <Input
                  id="new-fullName"
                  placeholder="John Doe"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-department">Department</Label>
                <Input
                  id="new-department"
                  placeholder="Support Team"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="john@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-phone">Phone</Label>
                <Input
                  id="new-phone"
                  placeholder="+1 (555) 000-0000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-job-title">Job Title</Label>
                <Select
                  value={newJobTitleId}
                  onValueChange={setNewJobTitleId}
                  disabled={isLoading}
                >
                  <SelectTrigger id="new-job-title">
                    <SelectValue placeholder="Select a job title" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTitles.map((title) => (
                      <SelectItem key={title.id} value={title.id}>
                        {title.nameAmharic} ({title.nameEnglish})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newRole === "teller" && (
                <div className="space-y-2">
                  <Label htmlFor="new-window">Assign to Window</Label>
                  <Select
                    value={newWindowId?.toString() || "none"}
                    onValueChange={(value) =>
                      setNewWindowId(value !== "none" ? Number(value) : null)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger id="new-window">
                      <SelectValue placeholder="Select window" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {windows
                        .filter(
                          (window) =>
                            !users.some(
                              (user) =>
                                user.windowId === window.id &&
                                user.role === "teller",
                            ),
                        )
                        .map((window) => (
                          <SelectItem
                            key={window.id}
                            value={window.id.toString()}
                          >
                            {window.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleAddEmployee}
                disabled={isLoading}
                className="flex-1"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Employee
              </Button>
              <Button
                onClick={() => setShowAddForm(false)}
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredUsers.length} Employee
            {filteredUsers.length !== 1 ? "s" : ""}
          </CardTitle>
          <CardDescription>
            {isLoading ? "Loading employees..." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading employees...
            </p>
          ) : filteredUsers.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No employees found in this category
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {editingUserId && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-base">Edit Employee</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {paginatedUsers
                      .filter((user) => user.id === editingUserId)
                      .map((user) => (
                        <div key={user.id} className="space-y-4">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Username</Label>
                              <Input
                                value={editingUsername}
                                onChange={(e) =>
                                  setEditingUsername(e.target.value)
                                }
                                className="h-8"
                                disabled={isLoading}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Role</Label>
                              <Select
                                value={editingRole}
                                onValueChange={(value) =>
                                  setEditingRole(
                                    value as
                                      | "reception"
                                      | "teller"
                                      | "admin"
                                      | "employee"
                                      | "archiever",
                                  )
                                }
                                disabled={isLoading}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="reception">
                                    Reception
                                  </SelectItem>
                                  <SelectItem value="teller">Teller</SelectItem>
                                  <SelectItem value="employee">
                                    Employee
                                  </SelectItem>
                                  <SelectItem value="archiever">
                                    Archiever
                                  </SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Full Name</Label>
                              <Input
                                value={editingFullName}
                                onChange={(e) =>
                                  setEditingFullName(e.target.value)
                                }
                                className="h-8"
                                disabled={isLoading}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Department</Label>
                              <Input
                                value={editingDepartment}
                                onChange={(e) =>
                                  setEditingDepartment(e.target.value)
                                }
                                className="h-8"
                                disabled={isLoading}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Email</Label>
                              <Input
                                type="email"
                                value={editingEmail}
                                onChange={(e) =>
                                  setEditingEmail(e.target.value)
                                }
                                className="h-8"
                                disabled={isLoading}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Phone</Label>
                              <Input
                                value={editingPhone}
                                onChange={(e) =>
                                  setEditingPhone(e.target.value)
                                }
                                className="h-8"
                                disabled={isLoading}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Job Title</Label>
                              <Select
                                value={editingJobTitleId}
                                onValueChange={setEditingJobTitleId}
                                disabled={isLoading}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select a job title" />
                                </SelectTrigger>
                                <SelectContent>
                                  {jobTitles.map((title) => (
                                    <SelectItem key={title.id} value={title.id}>
                                      {title.nameAmharic} ({title.nameEnglish})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {editingRole === "teller" && (
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  Window Assignment
                                </Label>
                                <Select
                                  value={editingWindowId?.toString() || "none"}
                                  onValueChange={(value) =>
                                    setEditingWindowId(
                                      value !== "none" ? Number(value) : null,
                                    )
                                  }
                                  disabled={isLoading}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">
                                      Unassigned
                                    </SelectItem>
                                    {windows.map((window) => (
                                      <SelectItem
                                        key={window.id}
                                        value={window.id.toString()}
                                      >
                                        {window.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <div className="space-y-1">
                              <Label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={editingDisabled}
                                  onChange={(e) =>
                                    setEditingDisabled(e.target.checked)
                                  }
                                  disabled={isLoading}
                                  className="h-4 w-4"
                                />
                                Disable Account
                              </Label>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(user.id)}
                              disabled={isLoading}
                              className="gap-1"
                            >
                              <Check className="h-4 w-4" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingUserId(null)}
                              disabled={isLoading}
                              className="gap-1"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paginatedUsers
                  .filter((user) => user.id !== editingUserId)
                  .map((user) => (
                    <div key={user.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{user.username}</p>
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                            >
                              {user.role}
                            </span>
                            {user.disabled && (
                              <span className="inline-block rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.fullName && <span>{user.fullName}</span>}
                            {user.fullName && user.department && (
                              <span> • </span>
                            )}
                            {user.department && <span>{user.department}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {user.email && (
                              <span>
                                <a
                                  href={`mailto:${user.email}`}
                                  className="hover:underline"
                                >
                                  {user.email}
                                </a>
                              </span>
                            )}
                            {user.email && user.phone && <span> • </span>}
                            {user.phone && <span>{user.phone}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {user.jobTitleId && (
                              <span>
                                {
                                  jobTitles.find(
                                    (t) => t.id === user.jobTitleId,
                                  )?.nameAmharic
                                }
                              </span>
                            )}
                            {user.jobTitleId && user.role === "teller" && (
                              <span> • </span>
                            )}
                            {user.role === "teller" && (
                              <span>{getWindowName(user.windowId)}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditEmployee(user)}
                            className="h-8 w-8 p-0"
                            title="Edit employee"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResetPassword(user.id)}
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700"
                            title="Reset password"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteEmployee(user.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete employee"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to{" "}
                    {Math.min(endIndex, filteredUsers.length)} of{" "}
                    {filteredUsers.length} employees
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <Button
                            key={page}
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="h-8 w-8 p-0"
                          >
                            {page}
                          </Button>
                        ),
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog
        open={resetPasswordData !== null}
        onOpenChange={() => {
          if (!resetPasswordData) return;
          setResetPasswordData(null);
          setResetPasswordUserId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password Reset Successfully</DialogTitle>
            <DialogDescription>
              New password for employee{" "}
              <strong>{resetPasswordData?.username}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password" className="text-sm">
                New Password
              </Label>
              <div className="flex gap-2">
                <Input
                  id="reset-password"
                  type="text"
                  value={resetPasswordData?.password || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (resetPasswordData?.password) {
                      navigator.clipboard.writeText(resetPasswordData.password);
                      toast.success("Password copied to clipboard");
                    }
                  }}
                  className="px-3"
                >
                  Copy
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (
                      resetPasswordData?.username &&
                      resetPasswordData?.password
                    ) {
                      downloadEmployeePassword(
                        resetPasswordData.username,
                        resetPasswordData.password,
                      );
                    }
                  }}
                  className="px-3 gap-1"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this password with the employee securely. They should
                change it on first login.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setResetPasswordData(null);
                setResetPasswordUserId(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

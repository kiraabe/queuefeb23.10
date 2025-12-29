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
import { AlertCircle, Trash2, Plus, Edit2, X, Check } from "lucide-react";
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

export default function TellerManagement() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingWindowId, setEditingWindowId] = useState<number | null>(null);
  const [editingUsername, setEditingUsername] = useState<string>("");

  // New user form
  const [newUsername, setNewUsername] = useState("");
  const [newWindowId, setNewWindowId] = useState<number | null>(null);
  const [newFullName, setNewFullName] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newJobTitleId, setNewJobTitleId] = useState<string | null>(null);

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
        console.error("Users API error:", {
          status: usersRes.status,
          error: errorData,
        });
        throw new Error(
          errorData.error || `Users API failed: ${usersRes.status}`,
        );
      }

      if (!windowsRes.ok) {
        const errorData = await windowsRes.json().catch(() => ({}));
        console.error("Windows API error:", {
          status: windowsRes.status,
          error: errorData,
        });
        throw new Error(
          errorData.error || `Windows API failed: ${windowsRes.status}`,
        );
      }

      if (!jobTitlesRes.ok) {
        const errorData = await jobTitlesRes.json().catch(() => ({}));
        console.error("Job Titles API error:", {
          status: jobTitlesRes.status,
          error: errorData,
        });
        throw new Error(
          errorData.error || `Job Titles API failed: ${jobTitlesRes.status}`,
        );
      }

      const usersData: ListUsersResponse = await usersRes.json();
      const windowsData: ListWindowsResponse = await windowsRes.json();
      const jobTitlesData: ListJobTitlesResponse = await jobTitlesRes.json();

      // Filter only tellers
      const tellers = usersData.users.filter((u) => u.role === "teller");
      setUsers(tellers);
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

  const handleAddTeller = async () => {
    const username = newUsername.trim().toLowerCase();
    const fullName = newFullName.trim();
    const department = newDepartment.trim();
    const email = newEmail.trim();
    const phone = newPhone.trim();

    if (
      !username ||
      !fullName ||
      !department ||
      !email ||
      !phone ||
      !newJobTitleId
    ) {
      toast.error("All fields are required");
      return;
    }

    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
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
          role: "teller",
          windowId: newWindowId,
          fullName,
          department,
          email,
          phone,
          jobTitleId: newJobTitleId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create teller");
      }

      const data: CreateUserResponse = await response.json();
      setUsers([...users, data.user]);
      setNewUsername("");
      setNewWindowId(null);
      setNewFullName("");
      setNewDepartment("");
      setNewEmail("");
      setNewPhone("");
      setNewJobTitleId(null);
      toast.success("Teller created successfully");
    } catch (error) {
      console.error("Failed to create teller", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create teller",
      );
    }
  };

  const handleAssignWindow = async (
    userId: string,
    windowId: number | null,
  ) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/assign-window`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ windowId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign window");
      }

      const data: UpdateUserResponse = await response.json();
      setUsers(users.map((u) => (u.id === userId ? data.user : u)));
      setEditingUserId(null);
      setEditingWindowId(null);
      toast.success("Teller assigned successfully");
    } catch (error) {
      console.error("Failed to assign window", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to assign window",
      );
    }
  };

  const handleUpdateTeller = async (userId: string) => {
    const newName = editingUsername.trim();
    if (!newName) {
      toast.error("Username cannot be empty");
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
          username: newName,
          windowId: editingWindowId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update teller");
      }

      const data: UpdateUserResponse = await response.json();
      setUsers(users.map((u) => (u.id === userId ? data.user : u)));
      setEditingUserId(null);
      setEditingWindowId(null);
      setEditingUsername("");
      toast.success("Teller updated successfully");
    } catch (error) {
      console.error("Failed to update teller", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update teller",
      );
    }
  };

  const handleDeleteTeller = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    if (
      !confirm(`Are you sure you want to delete teller "${user.username}"?`)
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
        throw new Error(error.error || "Failed to delete teller");
      }

      setUsers(users.filter((u) => u.id !== userId));
      toast.success("Teller deleted successfully");
    } catch (error) {
      console.error("Failed to delete teller", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete teller",
      );
    }
  };

  const getWindowName = (windowId: number | null) => {
    if (!windowId) return "Unassigned";
    return windows.find((w) => w.id === windowId)?.name || `Window ${windowId}`;
  };

  return (
    <div className="space-y-4">
      {/* Tellers List */}
      <Card>
        <CardHeader>
          <CardTitle>Tellers</CardTitle>
          <CardDescription>
            Manage tellers and assign them to windows
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tellers...</p>
          ) : users.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No tellers found</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  {editingUserId === user.id ? (
                    <>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editingUsername}
                          onChange={(e) => setEditingUsername(e.target.value)}
                          placeholder="Username"
                          className="h-8"
                        />
                      </div>
                      <Select
                        value={editingWindowId?.toString() || "none"}
                        onValueChange={(value) =>
                          setEditingWindowId(
                            value !== "none" ? Number(value) : null,
                          )
                        }
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue placeholder="Select window" />
                        </SelectTrigger>
                        <SelectContent>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateTeller(user.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingUserId(null);
                          setEditingUsername("");
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{user.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.fullName && `${user.fullName} • `}
                          {user.department && `${user.department} • `}
                          {getWindowName(user.windowId)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingUserId(user.id);
                          setEditingWindowId(user.windowId);
                          setEditingUsername(user.username);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTeller(user.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add New Teller */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Teller</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Enter username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="Enter full name"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Input
                id="department"
                placeholder="Enter department"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                placeholder="Enter phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title *</Label>
              <Select
                value={newJobTitleId || ""}
                onValueChange={(value) => setNewJobTitleId(value || null)}
                disabled={isLoading}
              >
                <SelectTrigger id="jobTitle">
                  <SelectValue placeholder="Select job title" />
                </SelectTrigger>
                <SelectContent>
                  {jobTitles.map((title) => (
                    <SelectItem key={title.id} value={title.id}>
                      {title.nameAmharic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="window">Assign to Window (Optional)</Label>
              <Select
                value={newWindowId?.toString() || "none"}
                onValueChange={(value) =>
                  setNewWindowId(value !== "none" ? Number(value) : null)
                }
                disabled={isLoading}
              >
                <SelectTrigger id="window">
                  <SelectValue placeholder="Select window" />
                </SelectTrigger>
                <SelectContent>
                  {windows.map((window) => (
                    <SelectItem key={window.id} value={window.id.toString()}>
                      {window.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleAddTeller}
            className="w-full"
            disabled={isLoading}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Teller
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

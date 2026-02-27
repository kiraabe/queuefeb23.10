import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import type { ListJobTitlesResponse, ListUsersResponse } from "@shared/api";

interface StartCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function StartCaseDialog({
  open,
  onOpenChange,
  onSuccess,
}: StartCaseDialogProps) {
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const jobTitlesQuery = useQuery({
    queryKey: ["job-titles"],
    queryFn: () => apiFetch<ListJobTitlesResponse>("/api/admin/job-titles"),
    enabled: open,
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<ListUsersResponse>("/api/admin/users"),
    enabled: open,
  });

  const jobTitles = jobTitlesQuery.data?.jobTitles || [];
  const employees =
    usersQuery.data?.users.filter((u) => u.role === "employee") || [];

  const handleStart = async () => {
    if (!selectedJobTitle || !selectedEmployee) {
      toast.error("Please select both job title and employee");
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch("/api/employee/cases/start", {
        method: "POST",
        body: JSON.stringify({
          jobTitleId: selectedJobTitle,
          employeeId: selectedEmployee,
        }),
      });
      toast.success("Case started successfully");
      setSelectedJobTitle("");
      setSelectedEmployee("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start case",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Start a New Case</DialogTitle>
          <DialogDescription>
            Select a job title and assign an employee to start a new case.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Job Title</label>
            <Select
              value={selectedJobTitle}
              onValueChange={setSelectedJobTitle}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a job title" />
              </SelectTrigger>
              <SelectContent>
                {jobTitles.map((jt) => (
                  <SelectItem key={jt.id} value={jt.id}>
                    {jt.nameEnglish}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Assign Employee</label>
            <Select
              value={selectedEmployee}
              onValueChange={setSelectedEmployee}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.fullName || emp.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={isLoading}>
            {isLoading ? "Starting..." : "Start Case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

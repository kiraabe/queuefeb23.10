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

interface CaseActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  action: "proceed" | null;
  onSuccess?: () => void;
  currentUserId?: string;
}

export function CaseActionDialog({
  open,
  onOpenChange,
  caseId,
  action,
  onSuccess,
  currentUserId,
}: CaseActionDialogProps) {
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const jobTitlesQuery = useQuery({
    queryKey: ["job-titles"],
    queryFn: () => apiFetch<ListJobTitlesResponse>("/api/admin/job-titles"),
    enabled: open && action === "proceed",
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<ListUsersResponse>("/api/admin/users"),
    enabled: open && action === "proceed",
  });

  const jobTitles = jobTitlesQuery.data?.jobTitles || [];
  const allEmployees =
    usersQuery.data?.users.filter(
      (u) => u.role === "employee" && u.id !== currentUserId,
    ) || [];

  // Filter employees by selected job title
  const filteredEmployees = selectedJobTitle
    ? allEmployees.filter((emp) => emp.jobTitleId === selectedJobTitle)
    : [];

  const handleJobTitleChange = (jobTitleId: string) => {
    setSelectedJobTitle(jobTitleId);
    // Reset selected employee when job title changes
    setSelectedEmployee("");
  };

  const handleProceed = async () => {
    if (!selectedJobTitle || !selectedEmployee) {
      toast.error("Please select both job title and employee");
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch(`/api/employee/cases/${caseId}/proceed`, {
        method: "POST",
        body: JSON.stringify({
          jobTitleId: selectedJobTitle,
          nextEmployeeId: selectedEmployee,
        }),
      });
      toast.success("Case forwarded successfully");
      setSelectedJobTitle("");
      setSelectedEmployee("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to proceed case",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!action) return null;

  if (action === "proceed") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Forward Case</DialogTitle>
            <DialogDescription>
              Select a job title and choose the next responsible employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Job Title</label>
              <Select
                value={selectedJobTitle}
                onValueChange={handleJobTitleChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a job title" />
                </SelectTrigger>
                <SelectContent>
                  {jobTitles.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id}>
                      {jt.nameEnglish || jt.nameAmharic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Next Employee</label>
              <Select
                value={selectedEmployee}
                onValueChange={setSelectedEmployee}
                disabled={!selectedJobTitle}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedJobTitle
                        ? "Select a job title first"
                        : "Select an employee"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map((emp) => (
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
            <Button onClick={handleProceed} disabled={isLoading}>
              {isLoading ? "Forwarding..." : "Proceed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

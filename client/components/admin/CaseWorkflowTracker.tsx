import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ArrowRight,
  User,
  Clock,
} from "lucide-react";

// Sample process flow data for demonstration
const SAMPLE_WORKFLOW = {
  ticketCode: "S1-045",
  serviceCategory: "Land Rights & Property",
  selectedServices: ["Property Rights Registration", "Land Certificate Issuance"],
  items: [
    {
      id: "1",
      employeeName: "Abebe Assefa",
      jobTitle: "Reception Officer",
      status: "completed" as const,
      startedAt: "09:15:32",
      duration: "5m 20s",
      endedAt: "09:20:52",
    },
    {
      id: "2",
      employeeName: "Kebede Tesfaye",
      jobTitle: "Land Rights Officer",
      status: "completed" as const,
      startedAt: "09:20:52",
      duration: "12m 45s",
      endedAt: "09:33:37",
    },
    {
      id: "3",
      employeeName: "Fatima Hassan",
      jobTitle: "Document Verification Officer",
      status: "completed" as const,
      startedAt: "09:33:37",
      duration: "8m 15s",
      endedAt: "09:41:52",
    },
    {
      id: "4",
      employeeName: "Worku Bekele",
      jobTitle: "Final Approval Officer",
      status: "completed" as const,
      startedAt: "09:41:52",
      duration: "3m 08s",
      endedAt: "09:45:00",
    },
  ],
  totalDuration: "29m 28s",
};

const getStatusColor = (status: "completed" | "in_progress" | "proceeded") => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "proceeded":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusLabel = (status: "completed" | "in_progress" | "proceeded") => {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In Progress";
    case "proceeded":
      return "Forwarded";
    default:
      return status;
  }
};

export default function CaseWorkflowTracker() {
  const workflow = SAMPLE_WORKFLOW;

  return (
    <div className="space-y-6">
      {/* Process Flow Diagram Card */}
      <Card className="border-2 border-blue-200 dark:border-blue-900">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-t-lg">
          <div className="space-y-3">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                Ticket {workflow.ticketCode}
              </CardTitle>
              {workflow.serviceCategory && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-600 text-white dark:bg-blue-700">
                    Service Category
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">
                    {workflow.serviceCategory}
                  </span>
                </div>
              )}
              {workflow.selectedServices &&
                workflow.selectedServices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Selected Services:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {workflow.selectedServices.map((service, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="bg-white dark:bg-background"
                        >
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
            </div>
            <CardDescription className="text-base">
              Complete process flow visualization
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-8 pb-8">
          <div className="space-y-6">
            {/* Process Flow Steps */}
            <div className="space-y-4">
              {workflow.items.map((step, index) => (
                <div key={step.id} className="space-y-3">
                  {/* Step Node */}
                  <div className="flex items-start gap-4">
                    {/* Step Counter and Connector */}
                    <div className="flex flex-col items-center">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-lg flex-shrink-0 shadow-lg">
                        {index + 1}
                      </div>
                      {index < workflow.items.length - 1 && (
                        <div className="w-1 h-28 bg-gradient-to-b from-blue-500 to-blue-200 dark:from-blue-400 dark:to-blue-700 mt-2 rounded-full"></div>
                      )}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50 p-5 mt-1 hover:shadow-md transition-shadow">
                      <div className="space-y-4">
                        {/* Header: Name and Status */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 rounded-lg bg-blue-200 dark:bg-blue-800">
                              <User className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground text-lg">
                                {step.employeeName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {step.jobTitle}
                              </p>
                            </div>
                          </div>
                          <Badge className={`${getStatusColor(step.status)} flex-shrink-0`}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            {getStatusLabel(step.status)}
                          </Badge>
                        </div>

                        {/* Timeline Details */}
                        <div className="grid grid-cols-3 gap-3 bg-white dark:bg-background/50 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                              <Clock className="h-3 w-3" />
                              Started
                            </div>
                            <p className="font-mono font-semibold text-foreground text-sm">
                              {step.startedAt}
                            </p>
                          </div>
                          <div className="text-center border-l border-r border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-muted-foreground font-medium mb-1">
                              Duration
                            </p>
                            <p className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-sm">
                              {step.duration}
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                              <Clock className="h-3 w-3" />
                              Ended
                            </div>
                            <p className="font-mono font-semibold text-foreground text-sm">
                              {step.endedAt}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Arrow Between Steps */}
                  {index < workflow.items.length - 1 && (
                    <div className="flex justify-start pl-6 py-1">
                      <div className="flex items-center gap-2 text-blue-400 dark:text-blue-500">
                        <ArrowRight className="h-5 w-5 rotate-90" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Final Completion Node */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-lg flex-shrink-0 shadow-lg">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                </div>

                <div className="flex-1 rounded-lg border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/50 p-5 mt-1">
                  <p className="font-bold text-lg text-foreground">
                    Process Complete
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Total Steps
                      </p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                        {workflow.items.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Total Time
                      </p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                        {workflow.totalDuration}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats at Bottom */}
            <div className="border-t pt-6 grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Total Employees
                </p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                  {new Set(workflow.items.map((i) => i.employeeName)).size}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Total Process Time
                </p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                  {workflow.totalDuration}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Service Category
                </p>
                <p className="text-sm font-bold text-green-600 dark:text-green-400 mt-2 line-clamp-2">
                  {workflow.serviceCategory}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

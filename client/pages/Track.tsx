import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock4,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSSE } from "@/hooks/use-sse";
import type { Ticket, TicketStatusResponse } from "@shared/api";
import { cn } from "@/lib/utils";

async function fetchStatus(code: string): Promise<TicketStatusResponse> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(code)}`);
  if (!res.ok) {
    const text = await res.text();
    let errorMsg = text || "Ticket not found";
    // Try to parse JSON error response
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || json.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }
  return res.json();
}

interface TrackingState {
  stage: "input" | "loading" | "success" | "error";
  ticket: Ticket | null;
  position: number | null;
  estSeconds: number | null;
  error: string | null;
  searchedCode: string;
  currentEmployee?: {
    id: string;
    fullName: string;
    jobTitle: string;
    jobTitleAmharic?: string;
  } | null;
}

export default function Track() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<TrackingState>({
    stage: "input",
    ticket: null,
    position: null,
    estSeconds: null,
    error: null,
    searchedCode: "",
  });
  const [wasServing, setWasServing] = useState(false);

  const normalizeCode = (code: string): string => {
    const clean = code.trim();
    const numMatch = clean.match(/\d+/);
    if (!numMatch) return clean;
    const num = parseInt(numMatch[0], 10);
    return String(num).padStart(3, "0");
  };

  const isValidCode = (code: string): boolean => {
    const clean = code.trim();
    const numMatch = clean.match(/\d+/);
    if (!numMatch) return false;
    const num = parseInt(numMatch[0], 10);
    return num >= 1 && num <= 200;
  };

  const handleSearch = async (normalizedCode: string) => {
    setState({
      stage: "loading",
      ticket: null,
      position: null,
      estSeconds: null,
      error: null,
      searchedCode: normalizedCode,
    });

    try {
      const data = await fetchStatus(normalizedCode);
      console.log("Ticket search result:", { code: normalizedCode, data });
      if (data.ticket) {
        setState({
          stage: "success",
          ticket: data.ticket,
          position: data.positionInQueue,
          estSeconds: data.estimatedWaitSeconds ?? null,
          error: null,
          searchedCode: normalizedCode,
          currentEmployee: data.currentEmployee || null,
        });
      } else {
        console.log("Ticket not found for code:", normalizedCode);
        setState({
          stage: "error",
          ticket: null,
          position: null,
          estSeconds: null,
          error: "Ticket not found. Please check and try again.",
          searchedCode: normalizedCode,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "";
      console.error("Ticket search error:", {
        code: normalizedCode,
        error: errorMsg,
      });
      let displayError =
        "Unable to retrieve ticket information. Please try again later.";

      if (errorMsg.includes("Ticket not found") || errorMsg === "") {
        displayError = "Ticket not found. Please check and try again.";
      }

      setState({
        stage: "error",
        ticket: null,
        position: null,
        estSeconds: null,
        error: displayError,
        searchedCode: normalizedCode,
      });
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    if (isValidCode(value)) {
      const normalizedCode = normalizeCode(value);
      handleSearch(normalizedCode);
    } else if (value.trim() === "") {
      setState({
        stage: "input",
        ticket: null,
        position: null,
        estSeconds: null,
        error: null,
        searchedCode: "",
      });
    }
  };

  const handleReset = () => {
    setInput("");
    setState({
      stage: "input",
      ticket: null,
      position: null,
      estSeconds: null,
      error: null,
      searchedCode: "",
    });
    setWasServing(false);
  };

  // Show alert when ticket status changes to serving
  useEffect(() => {
    if (state.stage === "success" && state.ticket) {
      if (state.ticket.status === "serving" && !wasServing) {
        alert(`Ticket ${state.ticket.code} is now being served!`);
        setWasServing(true);
      } else if (state.ticket.status !== "serving") {
        setWasServing(false);
      }
    }
  }, [state.ticket, state.stage, wasServing]);

  useSSE("/api/events", (ev) => {
    if (state.stage !== "success" || !state.ticket) return;

    if (ev.type === "ticket.updated") {
      const t = ev.payload as Ticket;
      if (t.code === state.searchedCode) {
        setState((prev) => ({ ...prev, ticket: t }));
        fetchStatus(state.searchedCode)
          .then((d) => {
            setState((prev) => ({
              ...prev,
              position: d.positionInQueue,
              estSeconds: d.estimatedWaitSeconds ?? null,
              currentEmployee: d.currentEmployee || null,
            }));
          })
          .catch(() => {});
      }
      return;
    }

    if (ev.type === "display.updated" || ev.type === "window.updated") {
      fetchStatus(state.searchedCode)
        .then((d) => {
          setState((prev) => ({
            ...prev,
            ticket: d.ticket,
            position: d.positionInQueue,
            estSeconds: d.estimatedWaitSeconds ?? null,
            currentEmployee: d.currentEmployee || null,
          }));
        })
        .catch(() => {});
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-amber-500/10 text-amber-600 border-amber-500/40";
      case "serving":
        return "bg-green-500/10 text-green-600 border-green-500/40";
      case "done":
        return "bg-blue-500/10 text-blue-600 border-blue-500/40";
      case "skipped":
        return "bg-red-500/10 text-red-600 border-red-500/40";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/40";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "waiting":
        return <Clock4 className="h-5 w-5" />;
      case "serving":
        return <CheckCircle2 className="h-5 w-5" />;
      case "done":
        return <CheckCircle2 className="h-5 w-5" />;
      case "skipped":
        return <XCircle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getStatusMessage = (
    ticket: Ticket,
    currentEmployee?: {
      id: string;
      fullName: string;
      jobTitle: string;
      jobTitleAmharic?: string;
    } | null,
  ) => {
    if (ticket.status === "waiting") {
      return "Waiting in queue";
    }
    if (ticket.status === "serving") {
      if (currentEmployee) {
        return `Being handled by ${currentEmployee.fullName}`;
      }
      if (ticket.windowId) {
        return `Now Serving at Window ${ticket.windowId}`;
      }
      return "Now Serving";
    }
    if (ticket.status === "done") {
      return "Completed";
    }
    if (ticket.status === "skipped") {
      return "Skipped";
    }
    if (ticket.status === "transferred") {
      if (currentEmployee) {
        return `Transferred to ${currentEmployee.fullName}`;
      }
      return "Transferred";
    }
    return ticket.status;
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        {state.stage === "input" ? (
          <Card className="border-border/60 bg-card/90 shadow-xl">
            <CardHeader className="space-y-3">
              <CardTitle className="text-3xl">Track Your Ticket</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter your ticket number to check your queue status in real time
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="ticket-code" className="text-sm font-medium">
                    Ticket Number
                  </label>
                  <input
                    id="ticket-code"
                    type="text"
                    placeholder="Enter ticket number (e.g., S1-015 or 015)"
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg font-semibold placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    You can enter the full format (S1-015) or just the number
                    (015)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : state.stage === "loading" ? (
          <Card className="border-border/60 bg-card/90 shadow-xl">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
              <p className="mt-4 text-muted-foreground">
                Looking up your ticket...
              </p>
            </CardContent>
          </Card>
        ) : state.stage === "error" ? (
          <Card className="border-border/60 bg-card/90 shadow-xl">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <CardTitle className="text-red-600">Error</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700">
                {state.error}
              </div>
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : state.ticket ? (
          <Card className="border-border/60 bg-card/90 shadow-xl">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Your Ticket</CardTitle>
                <Badge
                  className={cn(
                    "flex items-center gap-1 text-xs uppercase",
                    getStatusColor(state.ticket.status),
                  )}
                >
                  {getStatusIcon(state.ticket.status)}
                  {state.ticket.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-6">
                <p className="text-xs uppercase tracking-widest text-primary">
                  Ticket Number
                </p>
                <p
                  className={cn(
                    "mt-2 font-display text-4xl font-bold",
                    state.ticket.status === "serving" ? "animate-blink" : "",
                  )}
                >
                  {state.ticket.code}
                </p>
              </div>

              <div
                className={cn(
                  "rounded-lg border p-6",
                  getStatusColor(state.ticket.status),
                )}
              >
                <p className="text-xs uppercase tracking-widest font-semibold">
                  Status
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {getStatusMessage(state.ticket, state.currentEmployee)}
                </p>
              </div>

              {state.currentEmployee &&
                (state.ticket.status === "serving" ||
                  state.ticket.status === "transferred") && (
                  <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-6">
                    <p className="text-xs uppercase tracking-widest font-semibold text-green-700 dark:text-green-300">
                      Currently Handled By
                    </p>
                    <p className="mt-2 text-lg font-semibold text-green-900 dark:text-green-100">
                      {state.currentEmployee.fullName}
                    </p>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {state.currentEmployee.jobTitle}
                      </p>
                      {state.currentEmployee.jobTitleAmharic && (
                        <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                          {state.currentEmployee.jobTitleAmharic}
                        </p>
                      )}
                    </div>
                  </div>
                )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Service
                  </p>
                  <p className="mt-2 font-display text-xl font-semibold">
                    {state.ticket.service}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Created
                  </p>
                  <p className="mt-2 font-display text-sm font-semibold">
                    {new Date(state.ticket.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {state.position !== null && (
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Position in Queue
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    #{state.position}
                  </p>
                </div>
              )}

              {state.estSeconds !== null && state.position !== null && (
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Estimated Wait Time
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold">
                    {Math.max(0, Math.round(state.estSeconds / 60))} minute
                    {Math.max(0, Math.round(state.estSeconds / 60)) !== 1
                      ? "s"
                      : ""}
                  </p>
                </div>
              )}

              {state.ticket.selectedServices &&
                state.ticket.selectedServices.length > 0 && (
                  <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase text-muted-foreground">
                      Selected Services
                    </p>
                    <ul className="mt-2 space-y-1">
                      {state.ticket.selectedServices.map(
                        (serviceName, index) => (
                          <li key={index} className="text-sm">
                            • {serviceName}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              {state.ticket.notes && (
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {state.ticket.notes}
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
                <p>Updates appear automatically as the queue progresses.</p>
              </div>

              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Track Another Ticket
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

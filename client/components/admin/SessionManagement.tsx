import { useState, useMemo } from "react";
import { useSessionWebSocket } from "@/hooks/useSessionWebSocket";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";
import type { SessionSummary } from "@shared/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Windows 11 uses the same "Windows NT 10.0" UA string as Windows 10.
 * The only reliable way to distinguish them is via the Sec-CH-UA-Platform-Version
 * client hint (major version >= 13 → Win11). When the server stores osVersion
 * it should already apply this logic. As a UI-side guard, if osName is "Windows"
 * and osVersion is exactly "10" we display "10 / 11" to avoid misreporting.
 */
function resolveOsLabel(osName: string | null, osVersion: string | null): string {
  const name = osName ?? "—";
  const version = osVersion ?? "";

  if (!version) return name;

  // Avoid asserting "10" when it might actually be 11
  if (name === "Windows" && version === "10") return "Windows 10 / 11";

  return `${name} ${version}`;
}

function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp || typeof timestamp !== "number") return "—";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "—";
  return format(date, "MMM d, HH:mm");
}

function formatDuration(start: number, end: number): string {
  const diff = (end - start) / 1000;
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  return `${Math.round(diff / 3600)}h`;
}

/**
 * Builds a stable page list like: [1, "...", 4, 5, 6, "...", 12]
 * Guarantees at most one ellipsis on each side with no duplicates.
 */
function buildPageList(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  const rangeStart = Math.max(2, current - 1);
  const rangeEnd = Math.min(total - 1, current + 1);

  if (rangeStart > 2) pages.push("...");
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
  if (rangeEnd < total - 1) pages.push("...");

  pages.push(total);
  return pages;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function statusClass(status: string): string {
  switch (status) {
    case "active": return "bg-green-100 text-green-800";
    case "revoked": return "bg-red-100 text-red-800";
    case "expired": return "bg-gray-100 text-gray-800";
    default: return "bg-blue-100 text-blue-800";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "active": return "✓ Login";
    case "revoked": return "✕ Logout";
    case "expired": return "⏱ Expired";
    default: return status;
  }
}

function statusDescription(status: string): string {
  switch (status) {
    case "active": return "User is currently logged in";
    case "revoked": return "Session was terminated (logout, admin action, or security event)";
    case "expired": return "Session exceeded its maximum lifetime";
    default: return "Unknown session status";
  }
}

function roleClass(role: string): string {
  switch (role) {
    case "admin": return "bg-purple-100 text-purple-800";
    case "reception": return "bg-blue-100 text-blue-800";
    case "teller": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={statusClass(status)}>{statusLabel(status)}</Badge>
      </TooltipTrigger>
      <TooltipContent>{statusDescription(status)}</TooltipContent>
    </Tooltip>
  );
}

function LocationCell({ session }: { session: SessionSummary }) {
  const short =
    session.country && session.city
      ? `${session.country} (${session.city})`
      : session.country ?? session.city ?? "—";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{short}</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-0.5">
          {session.city && <div>{session.city}</div>}
          {session.region && <div className="text-muted-foreground">{session.region}</div>}
          {session.country && (
            <div className="text-muted-foreground">
              {session.countryCode ? `${session.country} (${session.countryCode})` : session.country}
            </div>
          )}
          {!session.city && !session.region && !session.country && <div>Location unavailable</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function OsCell({ session }: { session: SessionSummary }) {
  const label = resolveOsLabel(session.osName ?? session.os ?? null, session.osVersion ?? null);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <div>{session.osName ?? session.os ?? "Unknown"}</div>
          {session.osVersion && (
            <div className="text-muted-foreground">Version: {session.osVersion}</div>
          )}
          {(session.osName === "Windows" || session.os === "Windows") &&
            session.osVersion === "10" && (
              <div className="text-muted-foreground mt-1">
                Windows 11 uses the same user-agent as Windows 10.<br />
                Enable Sec-CH-UA-Platform-Version on the server for exact detection.
              </div>
            )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function BrowserCell({ session }: { session: SessionSummary }) {
  const name = session.browserName ?? session.browser ?? "—";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">
          {name}
          {session.browserVersion && (
            <div className="text-xs text-muted-foreground">v{session.browserVersion}</div>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <div>{name}</div>
          {session.browserVersion && (
            <div className="text-muted-foreground">v{session.browserVersion}</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function DeviceCell({ session }: { session: SessionSummary }) {
  const label = session.device ?? "Desktop";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-0.5">
          <div>{label}</div>
          {session.deviceVendor && (
            <div className="text-muted-foreground">Vendor: {session.deviceVendor}</div>
          )}
          {session.deviceModel && (
            <div className="text-muted-foreground">Model: {session.deviceModel}</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SessionManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const { sessions, isConnected, error, isLoading } = useSessionWebSocket();

  // ── Derived data ────────────────────────────────────────────────────────────

  const paginationData = useMemo(() => {
    // Build a map of username → all active sessions
    const userMap = new Map<string, SessionSummary[]>();
    for (const session of sessions) {
      if (session.status !== "active") continue;
      const bucket = userMap.get(session.username) ?? [];
      bucket.push(session);
      userMap.set(session.username, bucket);
    }

    // Representative session per user: most recently seen
    const uniqueUsers = Array.from(userMap.values()).map((bucket) =>
      bucket.reduce((latest, s) => (s.lastSeenAt > latest.lastSeenAt ? s : latest)),
    );

    const totalPages = Math.max(1, Math.ceil(uniqueUsers.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
    const currentSlice = uniqueUsers.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    return {
      currentSlice,
      totalPages,
      totalUsers: uniqueUsers.length,
      startIdx,
      userMap,
    };
  }, [sessions, currentPage]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleRevokeSession(sessionId: string) {
    if (!confirm("Terminate this session? The user will be signed out immediately.")) return;

    setRevoking((prev) => new Set(prev).add(sessionId));
    setRevokeError(null);

    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? `Server returned ${response.status}`);
      }

      setRevokeSuccess("Session terminated.");
      setTimeout(() => setRevokeSuccess(null), 3000);
      // WebSocket pushes the updated session list automatically
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRevokeError(`Failed to terminate session: ${msg}`);
      setTimeout(() => setRevokeError(null), 5000);
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            <p className="ml-4 text-muted-foreground">Loading sessions…</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* Header card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>
                  {paginationData.totalUsers} user{paginationData.totalUsers !== 1 ? "s" : ""},
                  {" "}{sessions.length} session{sessions.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              <ConnectionBadge isConnected={isConnected} />
            </div>
          </CardHeader>
        </Card>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {revokeError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{revokeError}</AlertDescription>
          </Alert>
        )}
        {revokeSuccess && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-800">{revokeSuccess}</AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {paginationData.totalUsers === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No active sessions</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-0">
                <Accordion type="single" collapsible>
                  {paginationData.currentSlice.map((rep) => {
                    const allSessions = paginationData.userMap.get(rep.username) ?? [rep];
                    return (
                      <AccordionItem key={rep.username} value={rep.username}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex w-full items-center justify-between gap-4 py-2">
                            <div className="flex flex-1 items-center gap-4">
                              <div className="flex flex-col text-left">
                                <span className="font-medium">
                                  {rep.fullName ?? rep.username}
                                </span>
                                {rep.jobTitle && (
                                  <span className="text-xs text-muted-foreground">
                                    {rep.jobTitle}
                                  </span>
                                )}
                              </div>
                              <Badge className={roleClass(rep.role)}>{rep.role}</Badge>
                              <Badge variant="outline">
                                {allSessions.length} device{allSessions.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <StatusBadge status={rep.status} />
                          </div>
                        </AccordionTrigger>

                        <AccordionContent>
                          <div className="overflow-x-auto mt-4 max-h-96 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Window</TableHead>
                                  <TableHead>Device</TableHead>
                                  <TableHead>Browser</TableHead>
                                  <TableHead>OS</TableHead>
                                  <TableHead>IP Address</TableHead>
                                  <TableHead>Location</TableHead>
                                  <TableHead>Logged In</TableHead>
                                  <TableHead>Last Seen</TableHead>
                                  <TableHead>Duration</TableHead>
                                  <TableHead>Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {allSessions.map((session) => (
                                  <TableRow key={session.id}>
                                    <TableCell>
                                      <StatusBadge status={session.status} />
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {session.windowId ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[120px] truncate">
                                      <DeviceCell session={session} />
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[150px]">
                                      <BrowserCell session={session} />
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[150px]">
                                      <OsCell session={session} />
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {session.ipAddress ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[150px]">
                                      <LocationCell session={session} />
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {formatTime(session.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {formatTime(session.lastSeenAt)}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {formatDuration(session.createdAt, session.lastSeenAt)}
                                    </TableCell>
                                    <TableCell>
                                      {session.status === "active" && (
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => handleRevokeSession(session.id)}
                                          disabled={revoking.has(session.id)}
                                        >
                                          {revoking.has(session.id) ? (
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                          ) : (
                                            "Terminate"
                                          )}
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>

            {/* Pagination */}
            {paginationData.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold">{paginationData.startIdx + 1}</span>
                  {" "}–{" "}
                  <span className="font-semibold">
                    {Math.min(
                      paginationData.startIdx + ITEMS_PER_PAGE,
                      paginationData.totalUsers,
                    )}
                  </span>
                  {" "}of{" "}
                  <span className="font-semibold">{paginationData.totalUsers}</span>
                </p>

                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(1, p - 1)); }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>

                    {buildPageList(currentPage, paginationData.totalPages).map((page, idx) =>
                      page === "..." ? (
                        <PaginationItem key={`ellipsis-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === page}
                            onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage((p) => Math.min(paginationData.totalPages, p + 1));
                        }}
                        className={
                          currentPage === paginationData.totalPages
                            ? "pointer-events-none opacity-50"
                            : ""
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Tiny isolated component (avoids duplicating the live/polling badge) ──────

function ConnectionBadge({ isConnected }: { isConnected: boolean }) {
  return isConnected ? (
    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
      <span className="w-2 h-2 bg-green-600 rounded-full" />
      Live
    </span>
  ) : (
    <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
      <span className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
      Polling
    </span>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Megaphone,
  Play,
  SkipForward,
  Dot,
  User,
  MapPin,
  StickyNote,
  Layers,
  AlertCircle,
} from "lucide-react";
import { TicketSection } from "@/components/teller/TicketSection";
import { ProceedHandoffDialog } from "@/components/teller/ProceedHandoffDialog";
import { toast } from "sonner";
import { useSSE } from "@/hooks/use-sse";
import { apiFetch, apiUrl } from "@/lib/api";
import type {
  AnnouncementAudio,
  CallNextResponse,
  RecallResponse,
  Ticket,
  WindowState,
  TellerStats,
  TellerTicketsResponse,
  QueueSnapshot,
  ServiceType,
  ListServiceCategoriesResponse,
  JobTitle,
  ListJobTitlesResponse,
  UserInfo,
  ListUsersResponse,
} from "@shared/api";
import { useAuth } from "@/hooks/use-auth";

const SERVICE_INFO: Record<ServiceType, { name: string; description: string }> =
  {
    S1: {
      name: "Service 1",
      description: "Social security renewals and intake confirmations.",
    },
    S2: {
      name: "Service 2",
      description: "Benefits enrollment and account updates.",
    },
    S3: {
      name: "Service 3",
      description: "Document authentication and priority support.",
    },
  };

let currentAudio: { stop: () => void } | null = null;
async function playAnnouncementAudio(
  audio?: AnnouncementAudio | null,
): Promise<boolean> {
  if (!audio?.base64) return false;
  let url: string | undefined;
  try {
    if (typeof window === "undefined" || typeof window.atob !== "function")
      return false;
    if (currentAudio) {
      try {
        currentAudio.stop();
      } catch {}
      currentAudio = null;
    }
    const binary = window.atob(audio.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const mimeType = audio.mimeType || "audio/mpeg";
    const blob = new Blob([bytes], { type: mimeType });
    url = URL.createObjectURL(blob);
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const arrayBuffer = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 2.0;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start();
      currentAudio = {
        stop: () => {
          try {
            source.stop();
          } catch {}
          try {
            ctx.close();
          } catch {}
          if (url) URL.revokeObjectURL(url);
          currentAudio = null;
        },
      };
      source.onended = () => {
        if (url) URL.revokeObjectURL(url);
        try {
          ctx.close();
        } catch {}
        currentAudio = null;
      };
      return true;
    }
    const element = new Audio(url);
    element.volume = 1.0;
    element.addEventListener(
      "ended",
      () => {
        URL.revokeObjectURL(url!);
        currentAudio = null;
      },
      { once: true },
    );
    element.addEventListener(
      "error",
      () => {
        URL.revokeObjectURL(url!);
        currentAudio = null;
      },
      { once: true },
    );
    currentAudio = {
      stop: () => {
        try {
          element.pause();
          element.src = "";
        } catch {}
        if (url) URL.revokeObjectURL(url);
        currentAudio = null;
      },
    };
    await element.play();
    return true;
  } catch {
    if (url) URL.revokeObjectURL(url);
    if (currentAudio) {
      try {
        currentAudio.stop();
      } catch {}
      currentAudio = null;
    }
    return false;
  }
}

export default function TellerWindow() {
  const { id } = useParams<{ id: string }>();
  const windowId = Number(id);
  const { user } = useAuth();
  if (!Number.isFinite(windowId) || windowId < 1)
    return <Navigate to="/teller" replace />;
  if (user && user.role === "teller" && user.windowId !== windowId)
    return <Navigate to={`/teller/${user.windowId}`} replace />;

  const qc = useQueryClient();
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [tab, setTab] = useState<string>("completed");
  const [transferMessages, setTransferMessages] = useState<string[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [pendingTransferTarget, setPendingTransferTarget] = useState<
    number | undefined
  >();
  const [pendingTransferUserId, setPendingTransferUserId] = useState<
    string | undefined
  >();
  const [windowServices, setWindowServices] = useState<string[]>([]);
  const [serviceCategories, setServiceCategories] = useState<
    Array<{ id: string; code: string; name: string }>
  >([]);
  const [selectedJobTitleId, setSelectedJobTitleId] = useState<string | null>(
    null,
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const pushTransferMessage = (msg: string) =>
    setTransferMessages((m) => [msg, ...m].slice(0, 6));

  // Load service categories
  useEffect(() => {
    const loadServiceCategories = async () => {
      try {
        const response = await fetch("/api/service-categories", {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        });
        if (response.ok) {
          const data: ListServiceCategoriesResponse = await response.json();
          setServiceCategories(data.categories || []);
        }
      } catch (error) {
        console.error("Failed to load service categories", error);
      }
    };

    loadServiceCategories();
  }, []);

  // Load window services
  useEffect(() => {
    const loadWindowServices = async () => {
      try {
        const response = await fetch(
          `/api/admin/windows/${windowId}/services`,
          {
            headers: {
              "X-Requested-With": "XMLHttpRequest",
            },
          },
        );
        if (response.ok) {
          const data = await response.json();
          setWindowServices(data.services || []);
        }
      } catch (error) {
        console.error("Failed to load window services", error);
      }
    };

    loadWindowServices();
  }, [windowId]);

  // Reset tab selection and clear ticket data every 24 hours when tickets reset
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    const timer = setTimeout(() => {
      setTickets({});
      setTab("completed");
      // Remove all cached teller-tickets queries to ensure all tabs reset
      qc.removeQueries({
        queryKey: ["teller-tickets", windowId],
        exact: false,
      });
      qc.invalidateQueries({ queryKey: ["teller-stats", windowId] }).catch(
        () => {},
      );
    }, timeUntilMidnight);

    return () => clearTimeout(timer);
  }, [windowId, qc]);

  const windowQuery = useQuery({
    queryKey: ["window", windowId],
    queryFn: async () => {
      const all = await apiFetch<WindowState[]>("/api/windows");
      const w = all.find((x) => x.id === windowId);
      if (!w) throw new Error("Window not found");
      return w;
    },
    refetchInterval: 3000,
  });

  const statsQuery = useQuery({
    queryKey: ["teller-stats", windowId],
    queryFn: () => apiFetch<TellerStats>(`/api/teller/${windowId}/stats`),
    refetchInterval: 10000,
  });

  const ticketsQuery = useQuery({
    queryKey: ["teller-tickets", windowId, tab],
    queryFn: () =>
      apiFetch<TellerTicketsResponse>(
        `/api/teller/${windowId}/tickets?tab=${encodeURIComponent(tab)}`,
      ),
  });

  useSSE(apiUrl("/api/events"), (ev) => {
    if (ev.type === "init") {
      const payload = ev.payload as QueueSnapshot;
      if (payload?.tickets) setTickets(payload.tickets);
      const fromSnapshot = payload?.windows?.find((x) => x.id === windowId);
      if (fromSnapshot) {
        qc.setQueryData<WindowState>(["window", windowId], fromSnapshot);
      }
      return;
    }
    if (ev.type === "window.updated" && ev.payload.id === windowId) {
      qc.setQueryData<WindowState>(
        ["window", windowId],
        ev.payload as WindowState,
      );
    }
    if (ev.type === "ticket.created" || ev.type === "ticket.updated") {
      const t = ev.payload as Ticket;
      setTickets((m) => ({ ...m, [t.id]: t }));
      qc.invalidateQueries({ queryKey: ["teller-stats", windowId] }).catch(
        () => {},
      );
      qc.invalidateQueries({
        queryKey: ["teller-tickets", windowId],
        exact: false,
      }).catch(() => {});
    }
    if (ev.type === "display.updated") {
      qc.invalidateQueries({ queryKey: ["teller-stats", windowId] }).catch(
        () => {},
      );
    }
    if (ev.type === "transfer.success") {
      const payload = ev.payload as any;
      if (payload?.source?.id === windowId) {
        qc.invalidateQueries({
          queryKey: ["teller-tickets", windowId],
          exact: false,
        }).catch(() => {});
        qc.invalidateQueries({
          queryKey: ["teller-stats", windowId],
        }).catch(() => {});
        toast.success(
          payload?.message ||
            `Transferred ticket to ${payload?.target?.name || "another window"}`,
        );
      }
    }
    if (ev.type === "transfer.received") {
      const payload = ev.payload as any;
      if (payload?.target?.id === windowId) {
        qc.invalidateQueries({
          queryKey: ["teller-tickets", windowId],
          exact: false,
        }).catch(() => {});
        qc.invalidateQueries({
          queryKey: ["teller-stats", windowId],
        }).catch(() => {});
        toast.message(
          payload?.message ||
            `Received ticket from ${payload?.source?.name || "another window"}`,
        );
      }
    }
  });

  const speak = (text: string) => {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window))
        return;
      const synthesis = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      synthesis.cancel();
      synthesis.speak(utterance);
    } catch {}
  };

  const callNext = useMutation({
    mutationFn: async () =>
      apiFetch<CallNextResponse>(`/api/windows/${windowId}/call-next`, {
        method: "POST",
      }),
    onSuccess: async (data: any) => {
      if (data?.ticket && data?.window) {
        toast.success("Next customer called successfully.");
        try {
          console.log("callNext: server audio:", data?.audio);
        } catch {}
        const played = await playAnnouncementAudio(data.audio).catch((e) => {
          try {
            console.error("playAnnouncementAudio error", e);
          } catch {}
          return false;
        });
        if (!played) {
          // fallback to browser TTS
          const ticketLabel = data.ticket?.code || "";
          const msg = `Ticket number ${ticketLabel}, please proceed to the window.`;
          speak(msg);
        }
        // Also trigger a recall to re-announce the ticket (helps ensure loudspeaker/playback)
        try {
          // small delay to allow server state propagation
          setTimeout(() => {
            try {
              recall.mutate(undefined as any);
            } catch {}
          }, 500);
        } catch {}
      } else if (data?.message) {
        toast.message(data.message);
      } else {
        toast.message("No customers waiting in the queue");
      }
    },
    onError: (e: any) =>
      toast.error(
        e?.message || "An unexpected error occurred. Please try again later.",
      ),
  });
  const recall = useMutation({
    mutationFn: async (reason?: string) =>
      apiFetch<RecallResponse>(`/api/windows/${windowId}/recall`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async (data: any) => {
      if (data?.ticket) {
        toast.message("Ticket recalled.");
        try {
          await playAnnouncementAudio(data.audio);
        } catch {}
      } else {
        toast.message("No active ticket to recall");
      }
    },
    onError: (e: any) =>
      toast.error(
        e?.message || "An unexpected error occurred. Please try again later.",
      ),
  });
  const skip = useMutation({
    mutationFn: async (reason?: string) =>
      apiFetch(`/api/windows/${windowId}/skip`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (data: any) => {
      if (data?.ticket) toast.message("Ticket skipped.");
      else toast.message("No active ticket to skip");
    },
    onError: (e: any) =>
      toast.error(
        e?.message || "An unexpected error occurred. Please try again later.",
      ),
  });
  const transfer = useMutation({
    mutationFn: async ({
      targetWindowId,
      targetUserId,
      reason,
    }: {
      targetWindowId?: number;
      targetUserId?: string;
      reason?: string;
    }) =>
      apiFetch(`/api/windows/${windowId}/transfer`, {
        method: "POST",
        body: JSON.stringify({ targetWindowId, targetUserId, reason }),
      }),
    onSuccess: (data: any) => {
      if (data?.ticket && data?.target) {
        toast.success(
          `Ticket ${data.ticket.code} transferred to ${data.target.name} successfully`,
        );
      } else {
        toast.success("Transfer complete");
      }
      qc.invalidateQueries({
        queryKey: ["teller-tickets", windowId],
        exact: false,
      }).catch(() => {});
      qc.invalidateQueries({
        queryKey: ["teller-stats", windowId],
      }).catch(() => {});
    },
    onError: (e: any) => {
      let msg = "Transfer failed";
      if (e?.message) {
        msg = e.message;
      } else if (e?.error) {
        msg = e.error;
      } else if (typeof e === "string") {
        msg = e;
      }
      toast.error(msg);
    },
  });
  const [transferTarget, setTransferTarget] = useState<number | undefined>();

  const windowsQuery = useQuery({
    queryKey: ["windows"],
    queryFn: async () => apiFetch<WindowState[]>("/api/windows"),
  });
  const availableTargets = useMemo(
    () => (windowsQuery.data || []).filter((w) => w.id !== windowId && !w.busy),
    [windowsQuery.data, windowId],
  );
  useEffect(() => {
    if (availableTargets.length > 0 && !transferTarget) {
      setTransferTarget(availableTargets[0].id);
    }
  }, [availableTargets, transferTarget]);

  // Fetch job titles for transfer dialog
  const jobTitlesQuery = useQuery({
    queryKey: ["job-titles"],
    queryFn: async () =>
      apiFetch<ListJobTitlesResponse>("/api/admin/job-titles"),
  });

  // Fetch users with selected job title for transfer dialog
  const usersQuery = useQuery({
    queryKey: ["users-for-transfer", selectedJobTitleId],
    queryFn: async () => {
      if (!selectedJobTitleId) return { users: [] };
      return apiFetch<ListUsersResponse>(
        `/api/admin/users?jobTitleId=${encodeURIComponent(selectedJobTitleId)}`,
      );
    },
    enabled: Boolean(selectedJobTitleId),
  });

  const employeesWithJobTitle = useMemo(() => {
    if (!selectedJobTitleId || !usersQuery.data) return [];
    return usersQuery.data.users.filter(
      (u) => !u.disabled && u.windowId !== windowId,
    );
  }, [selectedJobTitleId, usersQuery.data, windowId]);

  const w = windowQuery.data;

  // derive current ticket from SSE cache first, then ticketsQuery
  const currentTicket = useMemo(() => {
    if (!w?.currentTicketId) return null;
    const direct = tickets[w.currentTicketId];
    if (direct) return direct;
    const list = ticketsQuery.data?.items?.find(
      (t) => t.id === w.currentTicketId,
    );
    return list ?? null;
  }, [tickets, ticketsQuery.data, w?.currentTicketId]);

  // Build dynamic service info from fetched service types
  const dynamicServiceInfo = SERVICE_INFO;

  const serviceMeta = currentTicket
    ? (dynamicServiceInfo[currentTicket.service] ?? null)
    : null;
  const detailGridClass = currentTicket
    ? "grid gap-4 sm:grid-cols-4"
    : "grid gap-4 sm:grid-cols-3";

  // compute derived stats from SSE tickets when DB-backed stats return their zero/defaults
  const derivedStats = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const isWithin24Hours = (timestamp: number | undefined) => {
      if (!timestamp) return false;
      return now - timestamp < oneDayMs;
    };

    // Merge SSE tickets map and server query items to maximize coverage
    const map: Record<string, Ticket> = { ...tickets };
    (ticketsQuery.data?.items || []).forEach((t) => {
      map[t.id] = { ...(map[t.id] || {}), ...t } as Ticket;
    });
    const all = Object.values(map);
    const servedToday = all.filter(
      (t) =>
        t.status === "done" &&
        t.windowId === windowId &&
        isWithin24Hours(t.createdAt),
    ).length;
    const skippedToday = all.filter(
      (t) =>
        t.status === "skipped" &&
        t.windowId === windowId &&
        isWithin24Hours(t.createdAt),
    ).length;
    const inProgress = all.filter(
      (t) =>
        (t.status === "serving" || t.status === "transferred") &&
        t.windowId === windowId &&
        isWithin24Hours(t.createdAt),
    ).length;
    const waiting = all.filter(
      (t) =>
        t.status === "waiting" &&
        isWithin24Hours(t.createdAt) &&
        windowServices.includes(t.service),
    ).length;
    const proceedToday = all.filter(
      (t) =>
        t.status === "transferred" &&
        (t.transferredToWindow === windowId ||
          t.transferredFromWindow === windowId) &&
        isWithin24Hours(t.transferredAt),
    ).length;
    // Try estimate avg handling from available done tickets in memory (best-effort)
    let avg: number | null = null;
    const doneTimes = all
      .filter(
        (t) =>
          t.status === "done" &&
          t.windowId === windowId &&
          t.createdAt &&
          (t as any).completedAt &&
          isWithin24Hours(t.createdAt),
      )
      .map((t) => Math.round((t as any).completedAt - t.createdAt));
    if (doneTimes.length) {
      avg = Math.round(
        doneTimes.reduce((a, b) => a + b, 0) / doneTimes.length / 1000,
      );
    }
    return {
      servedToday,
      skippedToday,
      inProgress,
      waiting,
      avgHandlingSecondsToday: avg,
      proceedToday,
    };
  }, [tickets, ticketsQuery.data, windowId, windowServices]);

  const useStatsFromServer = useMemo(() => {
    const s = statsQuery.data;
    if (!s) return false;
    const isDefaultEmpty =
      s.servedToday === 0 &&
      s.skippedToday === 0 &&
      s.inProgress === 0 &&
      s.waiting === 0 &&
      (s.avgHandlingSecondsToday === null ||
        s.avgHandlingSecondsToday === undefined) &&
      s.proceedToday === 0;
    return !isDefaultEmpty;
  }, [statsQuery.data]);

  const stats = useStatsFromServer ? statsQuery.data! : derivedStats;

  // compute tab items from merged ticket sources
  const tabItems = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const isWithin24Hours = (timestamp: number | undefined) => {
      if (!timestamp) return false;
      return now - timestamp < oneDayMs;
    };

    const map: Record<string, Ticket> = { ...tickets };
    (ticketsQuery.data?.items || []).forEach((t) => {
      map[t.id] = { ...(map[t.id] || {}), ...t } as Ticket;
    });
    const all = Object.values(map);
    if (tab === "completed") {
      return all
        .filter(
          (t) =>
            t.status === "done" &&
            t.windowId === windowId &&
            isWithin24Hours(t.createdAt),
        )
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    if (tab === "skipped") {
      return all
        .filter(
          (t) =>
            t.status === "skipped" &&
            t.windowId === windowId &&
            isWithin24Hours(t.createdAt),
        )
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    if (tab === "proceed") {
      return all
        .filter(
          (t) =>
            t.status === "transferred" &&
            (t.transferredToWindow === windowId ||
              t.transferredFromWindow === windowId) &&
            isWithin24Hours(t.transferredAt),
        )
        .sort((a, b) => (b.transferredAt || 0) - (a.transferredAt || 0));
    }
    // serving only
    return all
      .filter(
        (t) =>
          t.status === "serving" &&
          t.windowId === windowId &&
          isWithin24Hours(t.createdAt),
      )
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [tickets, ticketsQuery.data, tab, windowId]);

  const windowServiceNames = windowServices
    .map((code) => serviceCategories.find((cat) => cat.code === code)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="container py-10">
      <div className="mb-6">
        <h1 className="mb-2 font-display text-3xl font-semibold">
          {user?.fullName
            ? `${user.fullName} – Window ${windowId}`
            : `Window ${windowId}`}
        </h1>
        {windowServiceNames.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {windowServiceNames.map((serviceName) => (
              <Badge
                key={serviceName}
                variant="secondary"
                className="text-xs px-2 py-1"
              >
                {serviceName}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Stats summary */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        <Card className="border-border/60 bg-card/90 p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Customers Served Today
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {stats.servedToday ?? 0}
          </div>
        </Card>
        <Card className="border-border/60 bg-card/90 p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Tickets Skipped
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {stats.skippedToday ?? 0}
          </div>
        </Card>
        <Card
          className={`border-border/60 bg-card/90 p-4 ${
            stats.avgHandlingSecondsToday != null &&
            stats.avgHandlingSecondsToday > 1800
              ? "border-red-500/50 bg-red-500/10"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-muted-foreground">
              Average Handling Time
            </div>
            {stats.avgHandlingSecondsToday != null &&
              stats.avgHandlingSecondsToday > 1800 && (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
          </div>
          <div
            className={`mt-1 text-2xl font-semibold ${
              stats.avgHandlingSecondsToday != null &&
              stats.avgHandlingSecondsToday > 1800
                ? "text-red-600"
                : ""
            }`}
          >
            {stats.avgHandlingSecondsToday != null
              ? (() => {
                  const s = Math.round(stats.avgHandlingSecondsToday || 0);
                  if (s < 60) return `${s} sec`;
                  const m = Math.floor(s / 60);
                  const r = s % 60;
                  return r === 0 ? `${m} min` : `${m} min ${r} sec`;
                })()
              : "—"}
          </div>
        </Card>
        <Card className="border-border/60 bg-card/90 p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Currently Serving
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {stats.inProgress ?? 0}
          </div>
        </Card>
        <Card className="border-border/60 bg-card/90 p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Waiting (Global)
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {stats.waiting ?? 0}
          </div>
        </Card>
        <Card className="border-border/60 bg-card/90 p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Proceed Today
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {stats.proceedToday ?? 0}
          </div>
        </Card>
      </div>

      {w && (
        <Card
          className={
            "relative overflow-hidden border border-border/60 bg-card/80 shadow-lg transition"
          }
        >
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary/70 via-accent/70 to-primary/70 ${
              w.busy ? "opacity-100" : "opacity-60"
            }`}
          />
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background font-display text-sm">
                  {w.id}
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-xl font-semibold tracking-tight">
                    {w.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(w.updatedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <Badge
                className={
                  w.busy
                    ? "bg-green-600 text-white hover:bg-green-600/90"
                    : "bg-muted text-foreground hover:bg-muted"
                }
              >
                <span className="mr-1 inline-flex h-2 w-2 items-center justify-center">
                  <Dot className={w.busy ? "text-white" : "text-foreground"} />
                </span>
                {w.busy ? "Serving" : "Idle"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section
              className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-accent/30 via-background to-background p-5"
              role="status"
              aria-live="polite"
            >
              <p className="text-xs uppercase text-muted-foreground tracking-wider">
                Current ticket
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <h2
                  className={`font-display text-5xl font-bold tracking-widest ${
                    w.currentTicketId
                      ? "bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent"
                      : "text-muted-foreground"
                  }`}
                >
                  {w.currentTicketId ? (currentTicket?.code ?? "") : "—"}
                </h2>
                {w.currentTicketId && (
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    aria-label="Service"
                  >
                    {serviceMeta?.name ?? currentTicket?.service ?? ""}
                  </Badge>
                )}
              </div>
              {serviceMeta && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {serviceMeta.description}
                </p>
              )}
              <Separator className="my-4" />
              <div className={detailGridClass}>
                {currentTicket && (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" /> Service
                    </div>
                    <p className="text-sm font-semibold">
                      {serviceMeta?.name ?? currentTicket.service}
                    </p>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <User className="h-3.5 w-3.5" /> Owner
                  </div>
                  <p className="truncate text-sm font-medium">
                    {w.currentTicketId && (currentTicket?.ownerName ?? "")
                      ? currentTicket?.ownerName
                      : "—"}
                  </p>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> Woreda
                  </div>
                  <p className="truncate text-sm font-medium">
                    {w.currentTicketId && (currentTicket?.woreda ?? "")
                      ? currentTicket?.woreda
                      : "—"}
                  </p>
                </div>
                <div
                  className={`${
                    currentTicket ? "sm:col-span-2" : "sm:col-span-1"
                  } sm:min-w-0`}
                >
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <StickyNote className="h-3.5 w-3.5" /> Notes
                  </div>
                  <p className="line-clamp-2 whitespace-pre-wrap text-sm">
                    {w.currentTicketId && (currentTicket?.notes ?? "")
                      ? currentTicket?.notes
                      : "—"}
                  </p>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => callNext.mutate()}
                    disabled={callNext.isPending || Boolean(w?.currentTicketId)}
                  >
                    <Play className="mr-2 h-4 w-4" /> Call Next
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {w?.currentTicketId
                    ? "Please skip the current ticket first"
                    : "Call next ticket (FIFO)"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    onClick={() => recall.mutate(undefined)}
                    disabled={recall.isPending || !w.currentTicketId}
                  >
                    <Megaphone className="mr-2 h-4 w-4" /> Recall
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Announce current ticket again</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const reason = prompt("Reason for skipping? (optional)");
                      if (reason !== null) {
                        skip.mutate(reason || undefined);
                      }
                    }}
                    disabled={skip.isPending || !w.currentTicketId}
                  >
                    <SkipForward className="mr-2 h-4 w-4" /> Skip
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Skip current ticket</TooltipContent>
              </Tooltip>

              {w.currentTicketId && jobTitlesQuery.isLoading && (
                <p className="text-xs text-muted-foreground">
                  Loading job titles...
                </p>
              )}
              {w.currentTicketId && jobTitlesQuery.isError && (
                <p className="text-xs text-red-600">
                  Failed to load job titles
                </p>
              )}
              {w.currentTicketId &&
                !jobTitlesQuery.isLoading &&
                !jobTitlesQuery.isError &&
                (!jobTitlesQuery.data?.jobTitles ||
                  jobTitlesQuery.data.jobTitles.length === 0) && (
                  <p className="text-xs text-muted-foreground">
                    No job titles available
                  </p>
                )}
              {w.currentTicketId &&
                jobTitlesQuery.data?.jobTitles &&
                jobTitlesQuery.data.jobTitles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      className="h-10 rounded-md border border-border bg-background px-2 text-sm"
                      value={selectedJobTitleId ?? ""}
                      onChange={(e) => {
                        setSelectedJobTitleId(e.target.value || null);
                        setSelectedEmployeeId(null);
                      }}
                    >
                      <option value="">Select Job Title</option>
                      {jobTitlesQuery.data.jobTitles.map((title) => (
                        <option key={title.id} value={title.id}>
                          {title.nameAmharic}
                        </option>
                      ))}
                    </select>

                    {selectedJobTitleId && (
                      <select
                        className="h-10 rounded-md border border-border bg-background px-2 text-sm"
                        value={selectedEmployeeId ?? ""}
                        onChange={(e) =>
                          setSelectedEmployeeId(e.target.value || null)
                        }
                        disabled={
                          usersQuery.isPending ||
                          employeesWithJobTitle.length === 0
                        }
                      >
                        <option value="">
                          {usersQuery.isPending
                            ? "Loading employees..."
                            : employeesWithJobTitle.length === 0
                              ? "No employees with this job title"
                              : "Select Employee"}
                        </option>
                        {employeesWithJobTitle.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.fullName || employee.username}
                          </option>
                        ))}
                      </select>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const selected = employeesWithJobTitle.find(
                              (e) => e.id === selectedEmployeeId,
                            );

                            if (!w.currentTicketId) {
                              toast.error("No current ticket to proceed");
                              return;
                            }

                            if (!selected) {
                              toast.error("Employee not found");
                              return;
                            }

                            setPendingTransferTarget(selected.windowId);
                            setPendingTransferUserId(selected.id);
                            setTransferDialogOpen(true);
                          }}
                          disabled={transfer.isPending || !selectedEmployeeId}
                        >
                          <Layers className="mr-2 h-4 w-4" /> Proceed
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!w.currentTicketId
                          ? "Call next to get a ticket first"
                          : !selectedEmployeeId
                            ? "Select an employee first"
                            : "Transfer ticket to selected employee"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for ticket views */}
      <div className="mt-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="completed">Today's Completed</TabsTrigger>
            <TabsTrigger value="skipped">Today's Skipped</TabsTrigger>
            <TabsTrigger value="serving">Ongoing</TabsTrigger>
            <TabsTrigger value="proceed">Proceed</TabsTrigger>
          </TabsList>
          <TabsContent value="completed">
            <div className="mt-3">
              <TicketSection
                items={tabItems}
                title="Completed Today"
                pageSize={10}
              />
            </div>
          </TabsContent>
          <TabsContent value="skipped">
            <div className="mt-3">
              <TicketSection
                items={tabItems}
                title="Skipped Today"
                pageSize={10}
              />
            </div>
          </TabsContent>
          <TabsContent value="serving">
            <div className="mt-3">
              <TicketSection items={tabItems} title="Ongoing" pageSize={10} />
            </div>
          </TabsContent>
          <TabsContent value="proceed">
            <div className="mt-3">
              <TicketSection
                items={tabItems}
                title="Proceed Transfers"
                pageSize={10}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Proceed Handoff Dialog */}
      <ProceedHandoffDialog
        open={transferDialogOpen}
        onOpenChange={(open) => {
          setTransferDialogOpen(open);
          if (!open) {
            setPendingTransferTarget(undefined);
            setPendingTransferUserId(undefined);
          }
        }}
        onConfirm={(reason) => {
          if (pendingTransferUserId || pendingTransferTarget) {
            transfer.mutate({
              targetWindowId: pendingTransferTarget,
              targetUserId: pendingTransferUserId,
              reason,
            });
          }
        }}
        isLoading={transfer.isPending}
        ticket={currentTicket}
        targetUserName={
          employeesWithJobTitle.find((e) => e.id === selectedEmployeeId)
            ?.fullName ||
          selectedEmployeeId ||
          "selected employee"
        }
        targetWindowName={
          (windowsQuery.data || []).find((t) => t.id === pendingTransferTarget)
            ?.name
        }
      />
    </div>
  );
}

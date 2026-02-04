import { useEffect, useMemo, useState } from "react";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSSE } from "@/hooks/use-sse";
import { TicketSection } from "@/components/teller/TicketSection";
import type {
  AnnouncementAudio,
  CallNextResponse,
  RecallResponse,
  Ticket,
  WindowState,
} from "@shared/api";
import { toast } from "sonner";
import { apiFetch, apiUrl } from "@/lib/api";

let currentAudio: { stop: () => void } | null = null;

async function playAnnouncementAudio(
  audio?: AnnouncementAudio | null,
): Promise<boolean> {
  if (!audio?.base64) return false;
  let url: string | undefined;
  try {
    if (typeof window === "undefined" || typeof window.atob !== "function") {
      return false;
    }

    // stop previous audio if any
    if (currentAudio) {
      try {
        currentAudio.stop();
      } catch {}
      currentAudio = null;
    }

    const binary = window.atob(audio.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const mimeType = audio.mimeType || "audio/mpeg";
    const blob = new Blob([bytes], { type: mimeType });
    url = URL.createObjectURL(blob);

    // Prefer WebAudio API to allow amplification (gain > 1)
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const arrayBuffer = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      const gainNode = ctx.createGain();
      // Amplify audio: set gain > 1 for louder playback
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

    // Fallback: use <audio> element (limited to max volume 1.0)
    const element = new Audio(url);
    element.volume = 1.0; // max for audio element
    element.addEventListener(
      "ended",
      () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
      },
      { once: true },
    );
    element.addEventListener(
      "error",
      () => {
        URL.revokeObjectURL(url);
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
    if (url) {
      URL.revokeObjectURL(url);
    }
    if (currentAudio) {
      try {
        currentAudio.stop();
      } catch {}
      currentAudio = null;
    }
    return false;
  }
}

function speak(text: string, options?: { lang?: string }) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthesis.getVoices();
    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (options?.lang) {
      const target = options.lang.toLowerCase();
      selectedVoice =
        voices.find((v) => v.lang?.toLowerCase() === target) ??
        voices.find((v) =>
          v.lang?.toLowerCase().startsWith(target.split("-")[0]),
        );
      utterance.lang = options.lang;
    } else {
      selectedVoice = voices.find((v) => /en[-_]/i.test(v.lang));
      if (selectedVoice?.lang) utterance.lang = selectedVoice.lang;
    }

    if (!selectedVoice && voices.length > 0) {
      selectedVoice = voices[0];
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1;
    utterance.pitch = 1;
    synthesis.cancel();
    synthesis.speak(utterance);
  } catch {}
}

const AMHARIC_ONES: Record<number, string> = {
  0: "ዜሮ",
  1: "አንድ",
  2: "ሁለት",
  3: "ሶስት",
  4: "አራት",
  5: "አምስት",
  6: "ስድስት",
  7: "ሰ���ት",
  8: "ስም���ት",
  9: "ዘጠኝ",
};

const AMHARIC_TENS: Record<number, string> = {
  10: "አስር",
  20: "ሃያ",
  30: "ሠ��ሳ",
  40: "አርባ",
  50: "ሀምሳ",
  60: "ስልሳ",
  70: "ሰባ",
  80: "ሰማንያ",
  90: "ዘጠና",
};

function numberToAmharic(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    return String(value);
  }

  if (value <= 9) {
    return AMHARIC_ONES[value];
  }

  if (value === 10) {
    return AMHARIC_TENS[10];
  }

  if (value < 20) {
    return `አስራ ${AMHARIC_ONES[value - 10]}`;
  }

  if (value < 100) {
    const tens = Math.floor(value / 10) * 10;
    const remainder = value % 10;
    const tensWord = AMHARIC_TENS[tens];
    if (!tensWord) return String(value);
    return remainder ? `${tensWord} ${AMHARIC_ONES[remainder]}` : tensWord;
  }

  if (value === 100) {
    return "መቶ";
  }

  if (value < 200) {
    const remainder = value - 100;
    return remainder ? `መቶ ${numberToAmharic(remainder)}` : "መቶ";
  }

  if (value === 200) {
    return "ሁለት መቶ";
  }

  return String(value);
}

function parseNumberFromText(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatWindowNameAmharic(windowName: string): string {
  const windowNumber = parseNumberFromText(windowName);
  if (windowNumber === null) return windowName;
  const numberWord = numberToAmharic(windowNumber);
  return `መደብ ${numberWord}`;
}

function buildAmharicAnnouncementMessage(
  ticket: Ticket,
  windowName: string,
): string {
  const fallbackNumber = parseNumberFromText(ticket.code) ?? null;
  const ticketLabel =
    ticket.code ||
    (Number.isInteger(ticket.number) ? String(ticket.number) : null) ||
    (fallbackNumber !== null ? String(fallbackNumber) : "");
  const windowNumber = parseNumberFromText(windowName);
  const windowLabel =
    windowNumber !== null ? String(windowNumber) : windowName.trim();
  return `ቲኬት ቁጥር ${ticketLabel} እባ��ትን ወደ መስኮት ቁጥር ${windowLabel} ይሂዱ���`;
}

export default function Teller() {
  const qc = useQueryClient();
  const [selectedWindowId, setSelectedWindowId] = useState<number | null>(null);

  const windowsQuery = useQuery({
    queryKey: ["windows"],
    queryFn: async () => apiFetch<WindowState[]>("/api/windows"),
    refetchOnWindowFocus: false,
    refetchInterval: 3000,
  });

  const clearAllWindows = useMutation({
    mutationFn: async () =>
      apiFetch("/api/admin/clear-demo", { method: "POST" }),
    onSuccess: () => {
      toast.success("All windows cleared and reset to idle");
      qc.invalidateQueries({ queryKey: ["windows"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to clear windows"),
  });

  // Set the first window as selected on load
  useEffect(() => {
    if (
      windowsQuery.data &&
      windowsQuery.data.length > 0 &&
      selectedWindowId === null
    ) {
      setSelectedWindowId(windowsQuery.data[0].id);
    }
  }, [windowsQuery.data, selectedWindowId]);

  const [tickets, setTickets] = useState<Record<string, Ticket>>({});

  useSSE(apiUrl("/api/events"), (ev) => {
    if (ev.type === "init") {
      setTickets(ev.payload.tickets);
      qc.setQueryData(["windows"], ev.payload.windows as WindowState[]);
    }
    if (ev.type === "window.updated") {
      qc.setQueryData<WindowState[]>(["windows"], (prev) => {
        if (!prev) return prev;
        return prev.map((w) => (w.id === ev.payload.id ? ev.payload : w));
      });
    }
    if (ev.type === "ticket.created" || ev.type === "ticket.updated") {
      const t = ev.payload as Ticket;
      setTickets((m) => ({ ...m, [t.id]: t }));
    }
  });

  // Compute filtered items for each tab
  const tabItems = useMemo(() => {
    if (selectedWindowId === null) {
      return {
        completed: [],
        skipped: [],
        serving: [],
        transferred: [],
      };
    }
    const all = Object.values(tickets).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    );
    return {
      completed: all.filter(
        (t) => t.status === "done" && t.windowId === selectedWindowId,
      ),
      skipped: all.filter(
        (t) => t.status === "skipped" && t.windowId === selectedWindowId,
      ),
      serving: all.filter(
        (t) => t.status === "serving" && t.windowId === selectedWindowId,
      ),
      transferred: all.filter(
        (t) =>
          t.status === "transferred" &&
          (t.windowId === selectedWindowId ||
            t.transferredFromWindow === selectedWindowId),
      ),
    };
  }, [tickets, selectedWindowId]);

  const callNext = useMutation({
    mutationFn: async (p: { id: number }) =>
      apiFetch<CallNextResponse>(`/api/windows/${p.id}/call-next`, {
        method: "POST",
      }),
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ["windows"] });
      if (data?.ticket && data?.window) {
        const message = buildAmharicAnnouncementMessage(
          data.ticket,
          data.window.name,
        );
        const played = await playAnnouncementAudio(data.audio);
        if (!played) {
          speak(message, { lang: "am-ET" });
        }
      }
    },
  });

  const recall = useMutation({
    mutationFn: async (p: { id: number; reason?: string }) =>
      apiFetch<RecallResponse>(`/api/windows/${p.id}/recall`, {
        method: "POST",
        body: JSON.stringify({ reason: p.reason }),
      }),
    onSuccess: async (data, vars) => {
      const win = qc
        .getQueryData<WindowState[]>(["windows"])
        ?.find((w) => w.id === vars.id);
      if (data?.ticket && win) {
        const message = buildAmharicAnnouncementMessage(data.ticket, win.name);
        const played = await playAnnouncementAudio(data.audio);
        if (!played) {
          speak(message, { lang: "am-ET" });
        }
      }
      toast.message("Recalled current ticket");
    },
  });
  const complete = useMutation({
    mutationFn: async (id: number) =>
      apiFetch(`/api/windows/${id}/complete`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["windows"] }),
  });
  const skip = useMutation({
    mutationFn: async (p: { id: number; reason?: string }) =>
      apiFetch(`/api/windows/${p.id}/skip`, {
        method: "POST",
        body: JSON.stringify({ reason: p.reason }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["windows"] }),
  });
  const transfer = useMutation({
    mutationFn: async (p: { id: number; target: number }) =>
      apiFetch(`/api/windows/${p.id}/transfer`, {
        method: "POST",
        body: JSON.stringify({ targetWindowId: p.target }),
      }),
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ["windows"] });
      try {
        const ticket = data?.ticket;
        const target = data?.target;
        if (ticket && target) {
          toast.success(`Transferred ${ticket.code} to ${target.name}`);
        } else {
          toast.success("Transfer complete");
        }
      } catch (e) {
        toast.success("Transfer complete");
      }
    },
    onError: (err: any) => {
      const msg = err?.message || String(err) || "Transfer failed";
      toast.error(msg);
    },
  });

  // FIFO mode active: no per-window service selection

  return (
    <ConsoleShell title="Teller Console" className="lg:grid-cols-1">
      <div className="w-full space-y-8 sm:space-y-10">
        {/* Window Controls */}
        <div className="w-full">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-foreground">
              Window Controls
            </h2>
          </div>
          <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full">
            {windowsQuery.data?.map((w) => (
              <Card
                key={w.id}
                className={`border-border/70 cursor-pointer transition-all hover:shadow-md ${
                  selectedWindowId === w.id
                    ? "border-primary/60 bg-primary/5 shadow-sm shadow-primary/20"
                    : "bg-card/80 hover:bg-card/90"
                }`}
                onClick={() => setSelectedWindowId(w.id)}
                role="button"
                tabIndex={0}
                aria-pressed={selectedWindowId === w.id}
                aria-label={`Window ${w.name}, ${w.busy ? "serving" : "idle"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedWindowId(w.id);
                  }
                }}
              >
                <CardHeader className="pb-3 sm:pb-4">
                  <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                    <span>{w.name}</span>
                    <span
                      className={`text-xs sm:text-sm font-medium ${w.busy ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                    >
                      {w.busy ? "Serving" : "Idle"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg sm:rounded-xl border border-border/60 bg-background/70 p-3 sm:p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                      Current ticket
                    </p>
                    <p className="mt-2 font-display text-xl sm:text-2xl font-bold text-foreground">
                      {w.currentTicketId
                        ? (tickets[w.currentTicketId]?.code ?? "")
                        : "—"}
                    </p>
                    {w.currentTicketId && (
                      <div className="mt-3 space-y-2 text-xs sm:text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Owner</span>
                          <span className="font-medium text-foreground">
                            {tickets[w.currentTicketId]?.ownerName ?? "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Woreda</span>
                          <span className="font-medium text-foreground">
                            {tickets[w.currentTicketId]?.woreda ?? "—"}
                          </span>
                        </div>
                        {tickets[w.currentTicketId]?.landCertificateKarta && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              karta (ካርታ) ser no.
                            </span>
                            <span className="font-medium text-blue-600">
                              {tickets[w.currentTicketId].landCertificateKarta}
                            </span>
                          </div>
                        )}
                        {tickets[w.currentTicketId]?.landCertificateDigital && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              karta (ካርታ) No.
                            </span>
                            <span className="font-medium text-green-600">
                              {
                                tickets[w.currentTicketId]
                                  .landCertificateDigital
                              }
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                            Notes
                          </p>
                          <p className="whitespace-pre-wrap text-xs text-foreground mt-1">
                            {tickets[w.currentTicketId]?.notes || "—"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => callNext.mutate({ id: w.id })}
                        disabled={
                          callNext.isPending || Boolean(w.currentTicketId)
                        }
                        className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                      >
                        Call Next
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => recall.mutate({ id: w.id })}
                        disabled={recall.isPending || !w.currentTicketId}
                        className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                      >
                        Recall
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => complete.mutate(w.id)}
                        disabled={complete.isPending}
                        className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                      >
                        Done
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          const reason =
                            window.prompt("Reason for skipping? (optional)") ||
                            undefined;
                          skip.mutate({ id: w.id, reason });
                        }}
                        disabled={skip.isPending}
                        className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                      >
                        Skip
                      </Button>
                    </div>
                    <TransferControl
                      windowId={w.id}
                      onTransfer={(target) =>
                        transfer.mutate({ id: w.id, target })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Ticket History Sections */}
        {selectedWindowId !== null && (
          <div className="w-full space-y-6">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold text-foreground truncate">
              Ticket History for{" "}
              <span className="text-primary">
                {
                  windowsQuery.data?.find((w) => w.id === selectedWindowId)
                    ?.name
                }
              </span>
            </h2>

            <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2 w-full">
              <TicketSection
                items={tabItems.completed}
                title="Today's Completed"
              />
              <TicketSection items={tabItems.skipped} title="Today's Skipped" />
              <TicketSection items={tabItems.serving} title="Ongoing" />
              <TicketSection items={tabItems.transferred} title="Transferred" />
            </div>
          </div>
        )}
      </div>
    </ConsoleShell>
  );
}

function TransferControl({
  windowId,
  onTransfer,
}: {
  windowId: number;
  onTransfer: (target: number) => void;
}) {
  const { data } = useQuery({
    queryKey: ["windows"],
    queryFn: async () => apiFetch<WindowState[]>("/api/windows"),
  });
  const targets = useMemo(
    () => (data || []).filter((w) => w.id !== windowId),
    [data, windowId],
  );
  const [target, setTarget] = useState<number | undefined>(targets[0]?.id);
  useEffect(() => setTarget(targets[0]?.id), [targets]);

  if (targets.length === 0) return null;

  return (
    <div className="flex gap-2 w-full">
      <select
        className="h-9 sm:h-10 flex-1 rounded-md border border-border bg-background px-2 text-xs sm:text-sm"
        value={target}
        onChange={(e) => setTarget(Number(e.target.value))}
        aria-label="Select target window for transfer"
      >
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        onClick={() => target && onTransfer(target)}
        className="h-9 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm"
      >
        Transfer
      </Button>
    </div>
  );
}

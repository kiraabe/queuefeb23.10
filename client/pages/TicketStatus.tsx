import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSSE } from "@/hooks/use-sse";
import type { Ticket, TicketStatusResponse } from "@shared/api";

async function fetchStatus(code: string): Promise<TicketStatusResponse> {
  const res = await fetch(`/api/tickets/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function TicketStatus() {
  const { code = "" } = useParams<{ code: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [estSeconds, setEstSeconds] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    if (!code) return;
    fetchStatus(code)
      .then((d) => {
        if (stop) return;
        setTicket(d.ticket);
        setPosition(d.positionInQueue);
        setEstSeconds(d.estimatedWaitSeconds ?? null);
      })
      .catch(() => {});
    const id = setInterval(() => {
      fetchStatus(code)
        .then((d) => {
          if (stop) return;
          setTicket(d.ticket);
          setPosition(d.positionInQueue);
          setEstSeconds(d.estimatedWaitSeconds ?? null);
        })
        .catch(() => {});
    }, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [code]);

  useSSE("/api/events", (ev) => {
    if (ev.type === "ticket.updated") {
      const t = ev.payload as Ticket;
      if (t.code === code) {
        setTicket(t);
        fetchStatus(code)
          .then((d) => {
            setPosition(d.positionInQueue);
            setEstSeconds(d.estimatedWaitSeconds ?? null);
          })
          .catch(() => {});
      }
      return;
    }
    if (ev.type === "display.updated" || ev.type === "window.updated") {
      // Queue moved; refresh status for this code so position/ETA stay live
      fetchStatus(code)
        .then((d) => {
          setTicket(d.ticket);
          setPosition(d.positionInQueue);
          setEstSeconds(d.estimatedWaitSeconds ?? null);
        })
        .catch(() => {});
    }
  });

  if (!code) return <div className="container py-10">Missing ticket code.</div>;

  return (
    <div className="container py-10">
      <Card className="mx-auto max-w-xl border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ticket Status</span>
            {ticket && <Badge className="uppercase">{ticket.status}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
            <p className="text-xs uppercase text-muted-foreground">Ticket</p>
            <p className="mt-1 font-display text-2xl">{code}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase text-muted-foreground">Service</p>
              <p className="mt-1 font-display text-xl">
                {ticket?.service ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase text-muted-foreground">Window</p>
              <p className="mt-1 font-display text-xl">
                {ticket?.windowId ? `Window ${ticket.windowId}` : "—"}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase text-muted-foreground">
                Position
              </p>
              <p className="mt-1 font-display text-xl">{position ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase text-muted-foreground">
                Est. wait
              </p>
              <p className="mt-1 font-display text-xl">
                {estSeconds == null
                  ? "—"
                  : `${Math.max(0, Math.round(estSeconds / 60))} min`}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase text-muted-foreground">Created</p>
              <p className="mt-1 font-display text-xl">
                {ticket ? new Date(ticket.createdAt).toLocaleTimeString() : "—"}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
            <p className="text-xs uppercase text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {ticket?.notes || "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

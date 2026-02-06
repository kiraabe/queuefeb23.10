import { RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import {
  CallNextRequest,
  CreateTicketRequest,
  DisplayResponse,
  DisplayState,
  DisplayTicket,
  QueueEvent,
  ServiceType,
  Ticket,
  TransferRequest,
  WindowState,
  formatTicketCode,
  TicketStatusResponse,
  AnnouncementAudio,
} from "../../shared/api";
import { requestAivoovSpeech } from "../services/aivoov";
import { requestCambAiSpeech } from "../services/cambai";
import { requestWellSaidSpeech } from "../services/wellsaid";
import {
  listWindowsDb,
  createTicketDb,
  callNextDb,
  callNextAnyDb,
  callNextForWindowDb,
  recallDb,
  completeDb,
  skipDb,
  transferDb,
  displayStateDb,
  getPool,
  getTicketByCodeDb,
  logAudit,
  clearTicketNotesDb,
  initDb,
  enrichMultipleTicketsWithServiceNames,
  enrichSelectedServicesWithNames,
} from "../store/db";

const NUMBER_REGEX = /\d+/;

// Simple SSE hub
const sseClients = new Set<{
  id: string;
  res: any;
  heartbeat?: NodeJS.Timeout;
}>();
function sendSSE(ev: QueueEvent) {
  const data =
    `event: ${ev.type}\n` + `data: ${JSON.stringify(ev.payload)}\n\n`;
  for (const { res } of sseClients) res.write(data);
}

function extractNumber(value: string): number | null {
  const match = value.match(NUMBER_REGEX);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatTicketNumber(ticket: Ticket): string {
  if (Number.isInteger(ticket.number) && ticket.number > 0)
    return String(ticket.number).padStart(3, "0");
  const fallback = extractNumber(ticket.code);
  if (fallback) return String(fallback).padStart(3, "0");
  return ticket.code;
}

function buildAnnouncementSentenceAm(
  ticket: Ticket,
  window: WindowState,
): string {
  const ticketLabel = formatTicketNumber(ticket);
  const windowNumber = extractNumber(window.name) ?? window.id;
  return `ቲኬት ቁጥር ${ticketLabel} እባክዎን ወደ መስኮት ${windowNumber} ይሂዱ።`;
}

function buildAnnouncementSentenceEn(
  ticket: Ticket,
  window: WindowState,
  opts?: { secondRecall?: boolean },
): string {
  const ticketLabel = formatTicketNumber(ticket);
  const windowNumber = extractNumber(window.name) ?? window.id;
  if (opts?.secondRecall)
    return `Second recall: ticket number ${ticketLabel}, please proceed to window ${windowNumber}.`;
  return `Ticket number ${ticketLabel}, please proceed to window ${windowNumber}.`;
}

async function generateAnnouncementAudio(
  ticket: Ticket,
  window: WindowState,
  opts?: { forceEnglish?: boolean; secondRecall?: boolean },
): Promise<AnnouncementAudio | null> {
  if (opts?.forceEnglish || opts?.secondRecall) {
    const en = buildAnnouncementSentenceEn(ticket, window, {
      secondRecall: opts?.secondRecall,
    });
    const ws = await requestWellSaidSpeech(en);
    if (ws) return ws;
    const cambFallback = await requestCambAiSpeech(en);
    if (cambFallback) return cambFallback;
    return requestAivoovSpeech(en);
  }
  const sentence = buildAnnouncementSentenceAm(ticket, window);
  const cambAiAudio = await requestCambAiSpeech(sentence);
  if (cambAiAudio) return cambAiAudio;
  return requestAivoovSpeech(sentence);
}

export const sseHandler: RequestHandler = async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const client = { id: randomUUID(), res } as {
    id: string;
    res: any;
    heartbeat?: NodeJS.Timeout;
  };
  sseClients.add(client);

  // Heartbeat pings to keep connections alive across proxies
  client.heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\n` + `data: ${Date.now()}\n\n`);
    } catch {}
  }, 25000);

  try {
    const p = getPool();
    const windowsDb = await listWindowsDb();

    const ticketsRes = await p.query(
      `SELECT id, service, number, code, status, window_id,
              extract(epoch from created_at)*1000 as created_at,
              extract(epoch from started_at)*1000 as started_at,
              extract(epoch from completed_at)*1000 as completed_at,
              notes, owner_name, woreda, service_category, selected_services,
              transferred_from_window, transferred_to_window, transferred_to_user_id, remark,
              extract(epoch from transferred_at)*1000 as transferred_at
       FROM tickets`,
    );
    const ticketsList: Ticket[] = [];
    const ticketsMap: Record<string, Ticket> = {};
    for (const r of ticketsRes.rows) {
      const ticket: Ticket = {
        id: r.id,
        service: r.service,
        number: r.number,
        code: r.code,
        status: r.status,
        windowId: r.window_id,
        createdAt: Math.round(Number(r.created_at)),
        startedAt: r.started_at ? Math.round(Number(r.started_at)) : undefined,
        completedAt: r.completed_at
          ? Math.round(Number(r.completed_at))
          : undefined,
        notes: r.notes ?? undefined,
        ownerName: r.owner_name ?? undefined,
        woreda: r.woreda ?? undefined,
        serviceCategory: r.service_category ?? undefined,
        selectedServices: Array.isArray(r.selected_services)
          ? r.selected_services
          : typeof r.selected_services === "string"
            ? JSON.parse(r.selected_services)
            : undefined,
        remark: r.remark ?? undefined,
        transferredFromWindow: r.transferred_from_window ?? undefined,
        transferredToWindow: r.transferred_to_window ?? undefined,
        transferredToUserId: r.transferred_to_user_id ?? undefined,
        transferredAt: r.transferred_at
          ? Math.round(Number(r.transferred_at))
          : undefined,
        landCertificateKarta:
          r["Land Holding Rights Certificate (ካርታ) ser no."] ?? undefined,
        landCertificateDigital:
          r["Land Holding Rights Certificate (ካርታ) No."] ?? undefined,
      };
      ticketsList.push(ticket);
      ticketsMap[r.id] = ticket;
    }

    // Enrich all tickets with service names
    const enrichedTickets =
      await enrichMultipleTicketsWithServiceNames(ticketsList);
    for (const ticket of enrichedTickets) {
      ticketsMap[ticket.id] = ticket;
    }

    const countersRes = await p.query(
      `SELECT service, next_number FROM service_counters WHERE service != 'GLOBAL'`,
    );
    const waitingRes = await p.query(
      `SELECT id, service FROM tickets WHERE status='waiting' ORDER BY created_at, number`,
    );
    const servicesState: Record<
      ServiceType,
      { nextNumber: number; waitingIds: string[] }
    > = {};
    for (const r of countersRes.rows) {
      const svc = r.service as ServiceType;
      servicesState[svc] = {
        nextNumber: Number(r.next_number),
        waitingIds: [],
      };
    }
    for (const r of waitingRes.rows) {
      const svc = r.service as ServiceType;
      if (servicesState[svc]) servicesState[svc].waitingIds.push(r.id);
    }

    const payload = {
      windows: windowsDb,
      services: servicesState,
      tickets: ticketsMap,
      display: await displayStateDb(),
    };

    const init: QueueEvent = { type: "init", payload };
    res.write(
      `event: ${init.type}\n` + `data: ${JSON.stringify(init.payload)}\n\n`,
    );
  } catch (e) {
    console.error("SSE Handler error:", e);
    res.write(
      `event: error\n` + `data: ${JSON.stringify({ error: String(e) })}\n\n`,
    );
  }

  req.on("close", () => {
    if (client.heartbeat) clearInterval(client.heartbeat);
    sseClients.delete(client);
  });
};

export const createTicket: RequestHandler = async (req, res) => {
  const {
    service,
    notes,
    ownerName,
    woreda,
    serviceCategory,
    selectedServices,
    landCertificateKarta,
    landCertificateDigital,
  } = (req.body || {}) as CreateTicketRequest;
  const sanitize = (s?: string) => (s ?? "").toString().slice(0, 500).trim();
  const cleanNotes = sanitize(notes);
  const cleanOwner = sanitize(ownerName);
  const cleanWoreda = sanitize(woreda);
  const cleanCategory = sanitize(serviceCategory);
  const cleanLandCertKarta = sanitize(landCertificateKarta);
  const cleanLandCertDigital = sanitize(landCertificateDigital);

  try {
    const p = getPool();
    const validationResult = await p.query(
      `SELECT DISTINCT service FROM service_counters WHERE service != 'GLOBAL'`,
    );
    const validServices = validationResult.rows.map((r) => r.service);
    if (!validServices.includes(service)) {
      return res.status(400).json({
        error: `Invalid service code. Valid services: ${validServices.join(", ")}`,
      });
    }
  } catch (error) {
    console.error("Failed to validate service code", error);
    return res.status(500).json({ error: "Failed to validate service code" });
  }

  const svc = service as ServiceType;

  try {
    const t = await createTicketDb(
      svc,
      cleanNotes,
      cleanOwner,
      cleanWoreda,
      cleanCategory,
      selectedServices,
      cleanLandCertKarta,
      cleanLandCertDigital,
    );
    console.log("✅ Ticket created in DB:", {
      id: t.id,
      code: t.code,
      number: t.number,
      service: t.service,
    });
    try {
      const auth = (req as any).auth as
        | {
            id: string;
            username: string;
            role: string;
            windowId?: number | null;
          }
        | undefined;
      await logAudit({
        action: "ticket.created",
        userId: auth?.id ?? null,
        username: auth?.username ?? null,
        role: (auth?.role as any) ?? null,
        windowId: (auth?.windowId as any) ?? null,
        details: { service: svc, ownerName: cleanOwner, woreda: cleanWoreda },
      });
    } catch {}
    // Enrich ticket with service names
    const enrichedTicket = await enrichSelectedServicesWithNames(t);
    sendSSE({ type: "ticket.created", payload: enrichedTicket });
    const state = await displayStateDb();
    sendSSE({ type: "display.updated", payload: state });
    return res.status(201).json(enrichedTicket);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create ticket";
    res.status(400).json({ error: message });
  }
};

export const listWindows: RequestHandler = async (_req, res) => {
  try {
    const windows = await listWindowsDb();
    res.json(windows);
  } catch (error) {
    console.error("Failed to list windows:", error);
    res.status(500).json({
      error: "Failed to fetch windows. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const callNext: RequestHandler = async (req, res) => {
  const windowId = Number(req.params.id);
  const auth = (req as any).auth as
    | {
        id: string;
        username: string;
        role: string;
        windowId?: number | null;
      }
    | undefined;

  try {
    const windowsDb = await listWindowsDb();
    const w = windowsDb.find((x) => x.id === windowId);
    if (!w) return res.status(404).json({ error: "Window not found" });
    if (w.currentTicketId) {
      return res.status(400).json({
        error:
          "Please complete or skip the current ticket before calling next.",
        message:
          "Please complete or skip the current ticket before calling next.",
      });
    }

    const result = await callNextForWindowDb(windowId, auth?.id ?? null);
    if (!result.ticket) {
      const message =
        result.waitingCount === 0
          ? "No waiting customers"
          : "No customers waiting in the queue for this service type";
      return res.status(200).json({ message });
    }

    console.log(
      `CALLNEXT: window=${windowId} assigned_ticket=${result.ticket?.id} code=${result.ticket?.code}`,
    );

    // Enrich ticket with service names
    const enrichedTicket = await enrichSelectedServicesWithNames(result.ticket);

    sendSSE({ type: "window.updated", payload: result.window });
    sendSSE({ type: "ticket.updated", payload: enrichedTicket });
    const state = await displayStateDb();
    sendSSE({ type: "display.updated", payload: state });
    const audio = await generateAnnouncementAudio(
      enrichedTicket,
      result.window,
    );
    try {
      await logAudit({
        action: "window.callNext",
        userId: auth?.id ?? null,
        username: auth?.username ?? null,
        role: (auth?.role as any) ?? null,
        windowId,
        details: { ticketId: enrichedTicket?.id ?? null },
      });
    } catch {}
    return res.json({
      window: result.window,
      ticket: enrichedTicket,
      display: state,
      audio,
    });
  } catch (e: any) {
    console.error("callNext error:", e);
    return res.status(400).json({ error: e.message || String(e) });
  }
};

export const recall: RequestHandler = async (req, res) => {
  const windowId = Number(req.params.id);
  const { reason } = (req.body || {}) as { reason?: string };

  try {
    const { ticket, secondRecall } = await recallDb(windowId, reason);
    if (!ticket)
      return res.status(400).json({
        error: "No active ticket",
        message: "No active ticket to recall",
      });
    // Enrich ticket with service names
    const enrichedTicket = await enrichSelectedServicesWithNames(ticket);
    sendSSE({ type: "ticket.updated", payload: enrichedTicket });
    const state = await displayStateDb();
    sendSSE({ type: "display.updated", payload: state });
    const windowsDb = await listWindowsDb();
    const window = windowsDb.find((w) => w.id === windowId);
    const audio = window
      ? await generateAnnouncementAudio(enrichedTicket, window, {
          secondRecall: Boolean(secondRecall),
          forceEnglish: true,
        })
      : null;
    try {
      const auth = (req as any).auth as any;
      await logAudit({
        action: "window.recall",
        userId: auth?.id ?? null,
        username: auth?.username ?? null,
        role: (auth?.role as any) ?? null,
        windowId,
        details: {
          ticketId: enrichedTicket?.id ?? null,
          secondRecall: Boolean(secondRecall),
        },
      });
    } catch {}
    return res.json({
      ok: true,
      ticket: enrichedTicket,
      display: state,
      audio,
    });
  } catch (e: any) {
    console.error("recall error:", e);
    return res.status(400).json({ error: e.message || String(e) });
  }
};

export const complete: RequestHandler = async (req, res) => {
  const windowId = Number(req.params.id);

  try {
    const { window, ticket } = await completeDb(windowId);
    // Enrich ticket with service names
    const enrichedTicket = await enrichSelectedServicesWithNames(ticket);
    sendSSE({ type: "window.updated", payload: window });
    sendSSE({ type: "ticket.updated", payload: enrichedTicket });
    const state = await displayStateDb();
    sendSSE({ type: "display.updated", payload: state });
    try {
      const auth = (req as any).auth as any;
      await logAudit({
        action: "window.complete",
        userId: auth?.id ?? null,
        username: auth?.username ?? null,
        role: (auth?.role as any) ?? null,
        windowId,
        details: { ticketId: enrichedTicket?.id ?? null },
      });
    } catch {}
    return res.json({
      ok: true,
      ticket: enrichedTicket,
      window,
      display: state,
    });
  } catch (e: any) {
    console.error("complete error:", e);
    return res.status(400).json({ error: e.message || String(e) });
  }
};

export const skip: RequestHandler = async (req, res) => {
  const windowId = Number(req.params.id);
  const { reason } = (req.body || {}) as { reason?: string };

  try {
    const { window, ticket } = await skipDb(windowId, reason);
    // Enrich ticket with service names
    const enrichedTicket = await enrichSelectedServicesWithNames(ticket);
    sendSSE({ type: "window.updated", payload: window });
    sendSSE({ type: "ticket.updated", payload: enrichedTicket });
    const state = await displayStateDb();
    sendSSE({ type: "display.updated", payload: state });
    try {
      const auth = (req as any).auth as any;
      await logAudit({
        action: "window.skip",
        userId: auth?.id ?? null,
        username: auth?.username ?? null,
        role: (auth?.role as any) ?? null,
        windowId,
        details: { ticketId: enrichedTicket?.id ?? null },
      });
    } catch {}
    return res.json({
      ok: true,
      ticket: enrichedTicket,
      window,
      display: state,
    });
  } catch (e: any) {
    console.error("skip error:", e);
    return res.status(400).json({ error: e.message || String(e) });
  }
};

export const transfer: RequestHandler = async (req, res) => {
  const windowId = Number(req.params.id);
  const { targetWindowId, targetUserId, reason } = (req.body ||
    {}) as TransferRequest;

  try {
    const { source, target, ticket } = await transferDb(
      windowId,
      targetWindowId ? Number(targetWindowId) : undefined,
      reason,
      targetUserId,
    );
    sendSSE({ type: "window.updated", payload: source });
    sendSSE({ type: "window.updated", payload: target });
    // Enrich ticket with service names
    const enrichedTicket = await enrichSelectedServicesWithNames(ticket);
    sendSSE({ type: "ticket.updated", payload: enrichedTicket });
    const state = await displayStateDb();
    sendSSE({ type: "display.updated", payload: state });

    try {
      sendSSE({
        type: "transfer.success",
        payload: {
          source: { id: source.id, name: source.name },
          target: { id: target.id, name: target.name },
          ticket: { id: ticket?.id ?? null, code: ticket?.code ?? null },
          message: `Ticket ${ticket?.code ?? ""} transferred to ${target.name} successfully`,
        },
      });
      sendSSE({
        type: "transfer.received",
        payload: {
          source: { id: source.id, name: source.name },
          target: { id: target.id, name: target.name },
          ticket: { id: ticket?.id ?? null, code: ticket?.code ?? null },
          message: `New ticket ${ticket?.code ?? ""} received from ${source.name}`,
        },
      });
    } catch {}

    try {
      const auth = (req as any).auth as any;
      await logAudit({
        action: "window.transfer",
        userId: auth?.id ?? null,
        username: auth?.username ?? null,
        role: (auth?.role as any) ?? null,
        windowId,
        details: {
          ticketId: ticket?.id ?? null,
          ticketCode: ticket?.code ?? null,
          sourceWindowId: source.id,
          targetWindowId: target.id,
          reason: reason ?? null,
          status: "success",
          at: new Date().toISOString(),
        },
      });
    } catch {}

    return res.json({ ok: true, ticket, source, target, display: state });
  } catch (e: any) {
    const errorMessage =
      e instanceof Error
        ? e.message
        : typeof e === "string"
          ? e
          : typeof e === "object" && e !== null && "message" in e
            ? String(e.message)
            : String(e);

    console.error("Transfer error details:", {
      windowId,
      targetWindowId,
      targetUserId,
      error: errorMessage,
      errorType: typeof e,
      errorKeys: typeof e === "object" && e !== null ? Object.keys(e) : [],
      fullError: e,
    });

    try {
      const auth = (req as any).auth as any;
      await logAudit({
        action: "window.transfer_failed",
        userId: auth?.id ?? null,
        username: auth?.username ?? null,
        role: (auth?.role as any) ?? null,
        windowId,
        details: {
          targetWindowId: targetWindowId ? Number(targetWindowId) : null,
          targetUserId: targetUserId || null,
          error: errorMessage,
          at: new Date().toISOString(),
        },
      });
    } catch {}
    return res.status(400).json({ error: errorMessage });
  }
};

export const clearNotes: RequestHandler = async (req, res) => {
  const ticketId = String(req.params.ticketId || "");
  if (!ticketId) return res.status(400).json({ error: "Missing ticket ID" });

  try {
    const ticket = await clearTicketNotesDb(ticketId);
    // Enrich ticket with service names
    const enrichedTicket = await enrichSelectedServicesWithNames(ticket);
    sendSSE({ type: "ticket.updated", payload: enrichedTicket });
    return res.json({ ok: true, ticket: enrichedTicket });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || String(e) });
  }
};

export const displayData: RequestHandler = async (_req, res) => {
  try {
    const state = await displayStateDb();
    const response: DisplayResponse = { state };
    return res.json(response);
  } catch (err) {
    console.error("[displayData] Error:", err);
    try {
      const state = await displayStateDb();
      const response: DisplayResponse = { state };
      return res.status(500).json(response);
    } catch {
      return res.status(500).json({ error: "Failed to fetch display data" });
    }
  }
};

export const getTicketStatus: RequestHandler = async (req, res) => {
  const code = String(req.params.code || "");
  if (!code) return res.status(400).json({ error: "Missing ticket code" });

  console.log("🔍 getTicketStatus - searching for code:", code);

  try {
    const result = await getTicketByCodeDb(code);
    console.log("📊 DB search result:", {
      code,
      found: !!result.ticket,
      ticket: result.ticket
        ? { code: result.ticket.code, number: result.ticket.number }
        : null,
    });
    // Enrich ticket with service names
    const ticket = result.ticket
      ? await enrichSelectedServicesWithNames(result.ticket)
      : null;
    const payload: TicketStatusResponse = {
      ticket,
      positionInQueue: result.positionInQueue,
      estimatedWaitSeconds: result.estimatedWaitSeconds,
      currentEmployee: result.currentEmployee || null,
    };
    console.log("✅ getTicketStatus returning:", {
      code,
      hasTicket: !!ticket,
      status: ticket?.status || "N/A",
    });
    return res.json(payload);
  } catch (e: any) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("❌ getTicketStatus error:", {
      code,
      error: errorMsg,
      stack: e?.stack,
    });
    return res.status(500).json({ error: errorMsg || "Failed to fetch ticket" });
  }
};

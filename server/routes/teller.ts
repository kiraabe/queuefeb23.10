import type { RequestHandler } from "express";
import { getPool, enrichMultipleTicketsWithServiceNames } from "../store/db";
import type { Ticket } from "@shared/api";

export const tellerStats: RequestHandler = async (req, res) => {
  const windowId = Number(req.params.id);
  if (!Number.isInteger(windowId) || windowId <= 0)
    return res
      .status(400)
      .json({ error: "Invalid window id", message: "Invalid window id" });

  try {
    const p = getPool();
    const { rows: servedRows } = await p.query(
      `SELECT COUNT(*)::int AS c
       FROM tickets
      WHERE status = 'done'
        AND completed_at >= date_trunc('day', now())
        AND (window_id = $1 OR transferred_from_window = $1)`,
      [windowId],
    );
    const { rows: skippedRows } = await p.query(
      `SELECT COUNT(*)::int AS c
       FROM tickets
      WHERE status = 'skipped'
        AND skipped_by_window = $1
        AND skipped_at >= date_trunc('day', now())`,
      [windowId],
    );
    const { rows: inProgRows } = await p.query(
      `SELECT COUNT(*)::int AS c
       FROM tickets t
      WHERE t.status IN ('serving','transferred')
        AND (t.window_id = $1 OR t.transferred_from_window = $1 OR t.transferred_to_window = $1)
        AND t.created_at >= date_trunc('day', now())`,
      [windowId],
    );
    // Get service categories for this window
    const { rows: windowServicesRows } = await p.query(
      `SELECT DISTINCT service_category_code FROM window_services WHERE window_id=$1`,
      [windowId],
    );
    const serviceCodes = windowServicesRows.map((r) => r.service_category_code);

    // Count waiting tickets for this window's service categories
    let waitingQuery = `SELECT COUNT(*)::int AS c FROM tickets WHERE status = 'waiting'`;
    const waitingParams: any[] = [];

    if (serviceCodes.length > 0) {
      waitingQuery += ` AND service_category = ANY($1)`;
      waitingParams.push(serviceCodes);
    }

    const { rows: waitingRows } = await p.query(waitingQuery, waitingParams);
    const { rows: avgRows } = await p.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_seconds
       FROM tickets
      WHERE (window_id = $1 OR transferred_from_window = $1)
        AND completed_at IS NOT NULL AND started_at IS NOT NULL
        AND completed_at >= date_trunc('day', now())`,
      [windowId],
    );
    const { rows: proceedRows } = await p.query(
      `SELECT COUNT(*)::int AS c
       FROM tickets t
      WHERE t.status IN ('serving','transferred')
        AND (t.transferred_from_window = $1 OR t.transferred_to_window = $1)
        AND t.transferred_at IS NOT NULL
        AND t.created_at >= date_trunc('day', now())`,
      [windowId],
    );
    const avg =
      avgRows[0]?.avg_seconds != null
        ? Math.round(Number(avgRows[0].avg_seconds))
        : null;
    res.json({
      servedToday: Number(servedRows[0]?.c || 0),
      skippedToday: Number(skippedRows[0]?.c || 0),
      inProgress: Number(inProgRows[0]?.c || 0),
      waiting: Number(waitingRows[0]?.c || 0),
      avgHandlingSecondsToday: avg,
      proceedToday: Number(proceedRows[0]?.c || 0),
    });
  } catch (error) {
    console.error(
      `Failed to fetch teller stats for window ${windowId}:`,
      error,
    );
    res.status(500).json({
      error: "Failed to fetch statistics. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const tellerTickets: RequestHandler = async (req, res) => {
  const windowId = Number(req.params.id);
  const tab = String(req.query.tab || "completed");
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const offset = Math.max(Number(req.query.offset || 0), 0);

  if (!Number.isInteger(windowId) || windowId <= 0)
    return res
      .status(400)
      .json({ error: "Invalid window id", message: "Invalid window id" });

  const p = getPool();

  if (tab === "serving") {
    // Show all tickets in 'serving' or 'transferred' status related to this window
    // This includes:
    // - Tickets currently assigned to this window (window_id = this window)
    // - Tickets transferred FROM this window (transferred_from_window = this window)
    // - Tickets transferred TO this window (transferred_to_window = this window)
    // This ensures transferred tickets remain visible in the Ongoing queue
    const countRes = await p.query(
      `SELECT COUNT(*)::int AS total
         FROM tickets t
        WHERE t.status IN ('serving','transferred')
          AND (t.window_id = $1 OR t.transferred_from_window = $1 OR t.transferred_to_window = $1)
          AND t.created_at >= date_trunc('day', now())`,
      [windowId],
    );
    const { rows } = await p.query(
      `SELECT t.id, t.service, t.number, t.code, t.status, t.window_id, extract(epoch from t.created_at)*1000 as created_at, extract(epoch from t.started_at)*1000 as started_at, extract(epoch from t.completed_at)*1000 as completed_at, t.notes, t.owner_name, t.woreda, t.remark, extract(epoch from t.skipped_at)*1000 as skipped_at, t.skipped_by_window, t.transferred_from_window, t.transferred_to_window, extract(epoch from t.transferred_at)*1000 as transferred_at, t.service_category, t.selected_services, "Land Holding Rights Certificate (ካርታ) ser no.", "Land Holding Rights Certificate (ካርታ) No."
         FROM tickets t
        WHERE t.status IN ('serving','transferred')
          AND (t.window_id = $1 OR t.transferred_from_window = $1 OR t.transferred_to_window = $1)
          AND t.created_at >= date_trunc('day', now())
        ORDER BY CASE WHEN t.window_id = $1 THEN 0 ELSE 1 END, t.created_at DESC
        LIMIT $2 OFFSET $3`,
      [windowId, limit, offset],
    );

    // Convert rows to Ticket objects
    const tickets: Ticket[] = rows.map((r) => ({
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
      remark: r.remark ?? undefined,
      skippedAt: r.skipped_at ? Math.round(Number(r.skipped_at)) : null,
      skippedByWindow: r.skipped_by_window ?? null,
      transferredFromWindow: r.transferred_from_window ?? undefined,
      transferredToWindow: r.transferred_to_window ?? undefined,
      transferredAt: r.transferred_at
        ? Math.round(Number(r.transferred_at))
        : undefined,
      serviceCategory: r.service_category ?? undefined,
      selectedServices: Array.isArray(r.selected_services)
        ? r.selected_services
        : typeof r.selected_services === "string"
          ? JSON.parse(r.selected_services)
          : undefined,
    }));

    // Enrich tickets with service names
    const enrichedTickets =
      await enrichMultipleTicketsWithServiceNames(tickets);

    return res.json({
      items: enrichedTickets,
      total: Number(countRes.rows[0]?.total || 0),
    });
  }

  if (tab === "skipped") {
    const countRes = await p.query(
      `SELECT COUNT(*)::int AS total
         FROM tickets
        WHERE skipped_by_window = $1 AND status = 'skipped' AND skipped_at >= date_trunc('day', now())`,
      [windowId],
    );
    const { rows } = await p.query(
      `SELECT id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, remark, extract(epoch from skipped_at)*1000 as skipped_at, skipped_by_window, transferred_from_window, extract(epoch from transferred_at)*1000 as transferred_at, service_category, selected_services, "Land Holding Rights Certificate (ካርታ) ser no.", "Land Holding Rights Certificate (ካርታ) No."
         FROM tickets
        WHERE skipped_by_window = $1 AND status = 'skipped' AND skipped_at >= date_trunc('day', now())
        ORDER BY skipped_at DESC
        LIMIT $2 OFFSET $3`,
      [windowId, limit, offset],
    );

    // Convert rows to Ticket objects
    const tickets: Ticket[] = rows.map((r) => ({
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
      remark: r.remark ?? undefined,
      skippedAt: r.skipped_at ? Math.round(Number(r.skipped_at)) : null,
      skippedByWindow: r.skipped_by_window ?? null,
      transferredFromWindow: r.transferred_from_window ?? undefined,
      transferredAt: r.transferred_at
        ? Math.round(Number(r.transferred_at))
        : undefined,
      serviceCategory: r.service_category ?? undefined,
      selectedServices: Array.isArray(r.selected_services)
        ? r.selected_services
        : typeof r.selected_services === "string"
          ? JSON.parse(r.selected_services)
          : undefined,
    }));

    // Enrich tickets with service names
    const enrichedTickets =
      await enrichMultipleTicketsWithServiceNames(tickets);

    return res.json({
      items: enrichedTickets,
      total: Number(countRes.rows[0]?.total || 0),
    });
  }

  if (tab === "proceed") {
    const countRes = await p.query(
      `SELECT COUNT(*)::int AS total
         FROM transfer_history th
         JOIN tickets t ON t.id = th.ticket_id
        WHERE (th.to_window = $1 OR th.from_window = $1) AND t.status = 'transferred' AND t.created_at >= date_trunc('day', now())`,
      [windowId],
    );
    const { rows } = await p.query(
      `SELECT t.id, t.service, t.number, t.code, t.status, t.window_id as current_window_id, extract(epoch from t.created_at)*1000 as created_at, extract(epoch from t.started_at)*1000 as started_at, extract(epoch from t.completed_at)*1000 as completed_at, t.notes, t.owner_name, t.woreda, t.remark, th.from_window as transferred_from_window, th.to_window as transferred_to_window, extract(epoch from th.transferred_at)*1000 as transferred_at, t.service_category, t.selected_services
         FROM transfer_history th
         JOIN tickets t ON t.id = th.ticket_id
        WHERE (th.to_window = $1 OR th.from_window = $1) AND t.status = 'transferred' AND t.created_at >= date_trunc('day', now())
        ORDER BY th.transferred_at DESC
        LIMIT $2 OFFSET $3`,
      [windowId, limit, offset],
    );

    // Convert rows to Ticket objects
    const tickets: Ticket[] = rows.map((r) => ({
      id: r.id,
      service: r.service,
      number: r.number,
      code: r.code,
      status: r.status,
      windowId: r.current_window_id,
      createdAt: Math.round(Number(r.created_at)),
      startedAt: r.started_at ? Math.round(Number(r.started_at)) : undefined,
      completedAt: r.completed_at
        ? Math.round(Number(r.completed_at))
        : undefined,
      notes: r.notes ?? undefined,
      ownerName: r.owner_name ?? undefined,
      woreda: r.woreda ?? undefined,
      remark: r.remark ?? undefined,
      transferredFromWindow: r.transferred_from_window ?? undefined,
      transferredToWindow: r.transferred_to_window ?? undefined,
      transferredAt: r.transferred_at
        ? Math.round(Number(r.transferred_at))
        : undefined,
      serviceCategory: r.service_category ?? undefined,
      selectedServices: Array.isArray(r.selected_services)
        ? r.selected_services
        : typeof r.selected_services === "string"
          ? JSON.parse(r.selected_services)
          : undefined,
    }));

    // Enrich tickets with service names
    const enrichedTickets =
      await enrichMultipleTicketsWithServiceNames(tickets);

    const totalCount = Number(countRes.rows[0]?.total || 0);
    return res.json({
      items: enrichedTickets,
      total: totalCount,
    });
  }

  // default completed - show tickets that were:
  // 1. Served/completed by this window (window_id = $1)
  // 2. Transferred FROM this window (transferred_from_window = $1)
  // 3. Originally from this window but transferred to employees (window_id = $1 with transferred_to_user_id)
  const countRes = await p.query(
    `SELECT COUNT(*)::int AS total
       FROM tickets t
      WHERE t.status = 'done'
        AND t.completed_at >= date_trunc('day', now())
        AND (t.window_id = $1
          OR t.transferred_from_window = $1)`,
    [windowId],
  );
  const { rows } = await p.query(
    `SELECT id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, remark, service_category, selected_services
       FROM tickets t
      WHERE t.status = 'done'
        AND t.completed_at >= date_trunc('day', now())
        AND (t.window_id = $1
          OR t.transferred_from_window = $1)
      ORDER BY t.completed_at DESC
      LIMIT $2 OFFSET $3`,
    [windowId, limit, offset],
  );

  // Convert rows to Ticket objects
  const tickets: Ticket[] = rows.map((r) => ({
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
    remark: r.remark ?? undefined,
    serviceCategory: r.service_category ?? undefined,
    selectedServices: Array.isArray(r.selected_services)
      ? r.selected_services
      : typeof r.selected_services === "string"
        ? JSON.parse(r.selected_services)
        : undefined,
  }));

  // Enrich tickets with service names
  const enrichedTickets = await enrichMultipleTicketsWithServiceNames(tickets);

  return res.json({
    items: enrichedTickets,
    total: Number(countRes.rows[0]?.total || 0),
  });
};

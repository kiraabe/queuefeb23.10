import type { RequestHandler } from "express";
import { getPool, enrichMultipleTicketsWithServiceNames } from "../store/db";

export const employeeReceivedTickets: RequestHandler = async (req, res) => {
  const userId = (req as any).auth?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tab = String(req.query.tab || "received");
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const offset = Math.max(Number(req.query.offset || 0), 0);

  const p = getPool();

  try {
    // Build the common ticket selection query
    const selectTicketColumns = `t.id, t.service, t.number, t.code, t.status, t.window_id,
                extract(epoch from t.created_at)*1000 as created_at,
                extract(epoch from t.started_at)*1000 as started_at,
                extract(epoch from t.completed_at)*1000 as completed_at,
                t.notes, t.owner_name, t.woreda, t.remark, t.service_category, t.selected_services,
                t.transferred_from_window, t.transferred_to_window, t.transferred_to_user_id,
                extract(epoch from t.transferred_at)*1000 as transferred_at`;

    // For employees, show tickets transferred to them
    if (tab === "received") {
      const countRes = await p.query(
        `SELECT COUNT(*)::int AS total
         FROM tickets t
         WHERE t.status = 'transferred'
           AND t.transferred_to_user_id = $1
           AND t.created_at >= date_trunc('day', now())`,
        [userId],
      );

      const { rows } = await p.query(
        `SELECT ${selectTicketColumns}
         FROM tickets t
         WHERE t.status = 'transferred'
           AND t.transferred_to_user_id = $1
           AND t.created_at >= date_trunc('day', now())
         ORDER BY t.transferred_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      );

      const items = rows.map((r) => formatTicketResponse(r));
      const enrichedItems = await enrichMultipleTicketsWithServiceNames(items);
      return res.json({
        items: enrichedItems,
        total: Number(countRes.rows[0]?.total || 0),
      });
    }

    if (tab === "completed") {
      const countRes = await p.query(
        `SELECT COUNT(*)::int AS total
         FROM tickets t
         WHERE t.status = 'done'
           AND t.transferred_to_user_id = $1
           AND t.completed_at >= date_trunc('day', now())`,
        [userId],
      );

      const { rows } = await p.query(
        `SELECT ${selectTicketColumns}
         FROM tickets t
         WHERE t.status = 'done'
           AND t.transferred_to_user_id = $1
           AND t.completed_at >= date_trunc('day', now())
         ORDER BY t.completed_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
      );

      const items = rows.map((r) => formatTicketResponse(r));
      const enrichedItems = await enrichMultipleTicketsWithServiceNames(items);
      return res.json({
        items: enrichedItems,
        total: Number(countRes.rows[0]?.total || 0),
      });
    }

    // default: received
    const countRes = await p.query(
      `SELECT COUNT(*)::int AS total
       FROM tickets t
       WHERE t.status = 'transferred'
         AND t.transferred_to_user_id = $1
         AND t.created_at >= date_trunc('day', now())`,
      [userId],
    );

    const { rows } = await p.query(
      `SELECT ${selectTicketColumns}
       FROM tickets t
       WHERE t.status = 'transferred'
         AND t.transferred_to_user_id = $1
         AND t.created_at >= date_trunc('day', now())
       ORDER BY t.transferred_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    const items = rows.map((r) => formatTicketResponse(r));
    const enrichedItems = await enrichMultipleTicketsWithServiceNames(items);
    return res.json({
      items: enrichedItems,
      total: Number(countRes.rows[0]?.total || 0),
    });
  } catch (error) {
    console.error("Failed to fetch employee tickets:", error);
    res.status(500).json({
      error: "Failed to fetch tickets. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Helper function to format ticket response
function formatTicketResponse(r: any) {
  return {
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
    transferredFromWindow: r.transferred_from_window ?? undefined,
    transferredToWindow: r.transferred_to_window ?? undefined,
    transferredToUserId: r.transferred_to_user_id ?? undefined,
    transferredAt: r.transferred_at
      ? Math.round(Number(r.transferred_at))
      : undefined,
  };
}

export const employeeStats: RequestHandler = async (req, res) => {
  const userId = (req as any).auth?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const p = getPool();

    // Count received tickets today (transferred to this employee)
    const { rows: receivedRows } = await p.query(
      `SELECT COUNT(*)::int AS c
       FROM tickets t
       WHERE t.status = 'transferred'
         AND t.transferred_to_user_id = $1
         AND t.created_at >= date_trunc('day', now())`,
      [userId],
    );

    // Count completed tickets today (completed by this employee)
    const { rows: completedRows } = await p.query(
      `SELECT COUNT(*)::int AS c
       FROM tickets t
       WHERE t.status = 'done'
         AND t.transferred_to_user_id = $1
         AND t.completed_at >= date_trunc('day', now())`,
      [userId],
    );

    // Calculate average processing time (from transfer to completion) for this employee
    const { rows: avgRows } = await p.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (t.completed_at - t.transferred_at))) AS avg_seconds
       FROM tickets t
       WHERE t.status = 'done'
         AND t.transferred_to_user_id = $1
         AND t.transferred_at IS NOT NULL
         AND t.completed_at IS NOT NULL
         AND t.completed_at >= date_trunc('day', now())`,
      [userId],
    );

    const avg =
      avgRows[0]?.avg_seconds != null
        ? Math.round(Number(avgRows[0].avg_seconds))
        : null;

    res.json({
      receivedToday: Number(receivedRows[0]?.c || 0),
      completedToday: Number(completedRows[0]?.c || 0),
      avgProcessingSecondsToday: avg,
    });
  } catch (error) {
    console.error("Failed to fetch employee stats:", error);
    res.status(500).json({
      error: "Failed to fetch statistics. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const startCase: RequestHandler = async (req, res) => {
  const userId = (req as any).auth?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { jobTitleId, employeeId } = req.body as {
    jobTitleId?: string;
    employeeId?: string;
  };

  if (!jobTitleId || !employeeId) {
    return res.status(400).json({ error: "Missing jobTitleId or employeeId" });
  }

  try {
    const p = getPool();

    // Create a new ticket for this employee (transferred to them)
    const { rows } = await p.query(
      `INSERT INTO tickets (
        service, status, window_id, owner_name, woreda, remark, notes,
        transferred_from_window, transferred_to_user_id, transferred_at,
        created_at, service_category, started_at, started_by_user_id
      ) VALUES (
        $1, $2, NULL, $3, $4, $5, $6,
        NULL, $7, now(),
        now(), $8, now(), $9
      )
      RETURNING id, code`,
      [jobTitleId, "transferred", "", "", "", "", employeeId, jobTitleId, employeeId],
    );

    if (!rows.length) {
      return res.status(500).json({ error: "Failed to create case" });
    }

    res.json({
      id: rows[0].id,
      code: rows[0].code,
    });
  } catch (error) {
    console.error("Failed to start case:", error);
    res.status(500).json({
      error: "Failed to start case. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const proceedCase: RequestHandler = async (req, res) => {
  const userId = (req as any).auth?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const caseId = req.params.id;
  if (!caseId) {
    return res.status(400).json({ error: "Missing case id" });
  }

  const { jobTitleId, nextEmployeeId } = req.body as {
    jobTitleId?: string;
    nextEmployeeId?: string;
  };

  if (!jobTitleId || !nextEmployeeId) {
    return res.status(400).json({ error: "Missing jobTitleId or nextEmployeeId" });
  }

  try {
    const p = getPool();

    // Update ticket to transfer to next employee, record proceed time
    const { rows } = await p.query(
      `UPDATE tickets
       SET transferred_to_user_id = $1,
           transferred_at = now(),
           proceeded_at = now(),
           job_title_for_proceed = $2,
           status = 'transferred'
       WHERE id = $3 AND transferred_to_user_id = $4
       RETURNING id`,
      [nextEmployeeId, jobTitleId, caseId, userId],
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "Case not found or not assigned to you"
      });
    }

    res.json({ success: true, caseId: rows[0].id });
  } catch (error) {
    console.error("Failed to proceed case:", error);
    res.status(500).json({
      error: "Failed to proceed case. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const completeCase: RequestHandler = async (req, res) => {
  const userId = (req as any).auth?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const caseId = req.params.id;
  if (!caseId) {
    return res.status(400).json({ error: "Missing case id" });
  }

  try {
    const p = getPool();

    const { rows } = await p.query(
      `UPDATE tickets
       SET status = 'done',
           completed_at = now()
       WHERE id = $1 AND transferred_to_user_id = $2
       RETURNING id, completed_at`,
      [caseId, userId],
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ error: "Case not found or not assigned to you" });
    }

    res.json({ success: true, completedAt: rows[0].completed_at });
  } catch (error) {
    console.error("Failed to complete case:", error);
    res.status(500).json({
      error: "Failed to complete case. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

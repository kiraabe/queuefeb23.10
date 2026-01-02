import type { RequestHandler } from "express";
import { getPool, enrichMultipleTicketsWithServiceNames } from "../store/db";

// Helper function to safely parse selectedServices
function parseSelectedServices(data: any): string[] | undefined {
  if (Array.isArray(data)) {
    return data.filter((item) => typeof item === "string");
  }
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === "string");
      }
    } catch (e) {
      console.warn("Failed to parse selectedServices JSON:", data, e);
    }
  }
  return undefined;
}

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
    // Include LEFT JOIN with employee_case_performance to track if current employee has started this case
    const selectTicketColumns = `t.id, t.service, t.number, t.code, t.status, t.window_id,
                extract(epoch from t.created_at)*1000 as created_at,
                extract(epoch from t.started_at)*1000 as started_at,
                extract(epoch from t.completed_at)*1000 as completed_at,
                t.notes, t.owner_name, t.woreda, t.remark, t.service_category, t.selected_services,
                t.transferred_from_window, t.transferred_to_window, t.transferred_to_user_id,
                extract(epoch from t.transferred_at)*1000 as transferred_at,
                t.started_by_user_id,
                extract(epoch from t.proceeded_at)*1000 as proceeded_at,
                t.job_title_for_proceed,
                CASE WHEN ecp.id IS NOT NULL THEN extract(epoch from ecp.started_at)*1000 ELSE NULL END as employee_started_at`;

    // For employees, show tickets transferred to them
    if (tab === "received") {
      const countRes = await p.query(
        `SELECT COUNT(*)::int AS total
         FROM tickets t
         WHERE (t.status = 'transferred' OR t.status = 'serving')
           AND t.transferred_to_user_id = $1
           AND t.created_at >= date_trunc('day', now())`,
        [userId],
      );

      const { rows } = await p.query(
        `SELECT ${selectTicketColumns}
         FROM tickets t
         LEFT JOIN employee_case_performance ecp ON t.id = ecp.ticket_id AND ecp.employee_id = $1 AND ecp.status = 'in_progress'
         WHERE (t.status = 'transferred' OR t.status = 'serving')
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
        `SELECT COUNT(DISTINCT t.id)::int AS total
         FROM tickets t
         LEFT JOIN employee_case_performance ecp ON t.id = ecp.ticket_id
         WHERE t.status = 'done'
           AND t.completed_at >= date_trunc('day', now())
           AND (ecp.employee_id = $1 OR t.transferred_to_user_id = $1)`,
        [userId],
      );

      const { rows } = await p.query(
        `SELECT DISTINCT ON (t.id) ${selectTicketColumns}
         FROM tickets t
         LEFT JOIN employee_case_performance ecp ON t.id = ecp.ticket_id AND ecp.employee_id = $1 AND ecp.status = 'in_progress'
         WHERE t.status = 'done'
           AND t.completed_at >= date_trunc('day', now())
           AND EXISTS (
             SELECT 1 FROM employee_case_performance ecp2
             WHERE ecp2.ticket_id = t.id AND ecp2.employee_id = $1
           )
         ORDER BY t.id, t.completed_at DESC
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
       WHERE (t.status = 'transferred' OR t.status = 'serving')
         AND t.transferred_to_user_id = $1
         AND t.created_at >= date_trunc('day', now())`,
      [userId],
    );

    const { rows } = await p.query(
      `SELECT ${selectTicketColumns}
       FROM tickets t
       LEFT JOIN employee_case_performance ecp ON t.id = ecp.ticket_id AND ecp.employee_id = $1 AND ecp.status = 'in_progress'
       WHERE (t.status = 'transferred' OR t.status = 'serving')
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
  const selectedServices = parseSelectedServices(r.selected_services);

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
    selectedServices,
    transferredFromWindow: r.transferred_from_window ?? undefined,
    transferredToWindow: r.transferred_to_window ?? undefined,
    transferredToUserId: r.transferred_to_user_id ?? undefined,
    transferredAt: r.transferred_at
      ? Math.round(Number(r.transferred_at))
      : undefined,
    startedByUserId: r.started_by_user_id ?? undefined,
    proceededAt: r.proceeded_at
      ? Math.round(Number(r.proceeded_at))
      : undefined,
    jobTitleForProceed: r.job_title_for_proceed ?? undefined,
    employeeStartedAt: r.employee_started_at
      ? Math.round(Number(r.employee_started_at))
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

    // Count received tickets today (transferred to this employee - includes both 'transferred' and 'serving' status)
    const { rows: receivedRows } = await p.query(
      `SELECT COUNT(*)::int AS c
       FROM tickets t
       WHERE (t.status = 'transferred' OR t.status = 'serving')
         AND t.transferred_to_user_id = $1
         AND t.created_at >= date_trunc('day', now())`,
      [userId],
    );

    // Count completed tickets today (completed by this employee or where they participated)
    const { rows: completedRows } = await p.query(
      `SELECT COUNT(DISTINCT t.id)::int AS c
       FROM tickets t
       LEFT JOIN employee_case_performance ecp ON t.id = ecp.ticket_id
       WHERE t.status = 'done'
         AND t.completed_at >= date_trunc('day', now())
         AND ecp.employee_id = $1`,
      [userId],
    );

    // Count proceeded tickets today (cases forwarded by this employee)
    const { rows: proceedRows } = await p.query(
      `SELECT COUNT(DISTINCT t.id)::int AS c
       FROM tickets t
       LEFT JOIN employee_case_performance ecp ON t.id = ecp.ticket_id
       WHERE ecp.employee_id = $1
         AND ecp.status = 'proceeded'
         AND ecp.created_at >= date_trunc('day', now())`,
      [userId],
    );

    res.json({
      receivedToday: Number(receivedRows[0]?.c || 0),
      completedToday: Number(completedRows[0]?.c || 0),
      proceedToday: Number(proceedRows[0]?.c || 0),
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
    // Note: Do NOT set started_at here - it should only be set when employee clicks Start
    const { rows } = await p.query(
      `INSERT INTO tickets (
        service, status, window_id, owner_name, woreda, remark, notes,
        transferred_from_window, transferred_to_user_id, transferred_at,
        created_at, service_category, required_documents
      ) VALUES (
        $1, $2, NULL, $3, $4, $5, $6,
        NULL, $7, now(),
        now(), $8, $9
      )
      RETURNING id, code`,
      [jobTitleId, "transferred", "", "", "", "", employeeId, jobTitleId, null],
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

export const handleStartCase: RequestHandler = async (req, res) => {
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
    const client = await p.connect();

    try {
      await client.query("BEGIN");

      // Get the case to check if it exists and is assigned to this employee
      const checkRes = await client.query(
        `SELECT id, service_category, started_at
         FROM tickets
         WHERE id = $1
           AND transferred_to_user_id = $2
           AND (status = 'transferred' OR status = 'serving')`,
        [caseId, userId],
      );

      if (!checkRes.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Case not found or not assigned to you",
        });
      }

      const ticket = checkRes.rows[0];
      let jobTitleId = ticket.service_category;

      // Only the first employee to start the case sets the ticket.started_at
      if (!ticket.started_at) {
        await client.query(
          `UPDATE tickets
           SET started_at = now(),
               started_by_user_id = $1
           WHERE id = $2`,
          [userId, caseId],
        );
      }

      // Check if this employee already has a performance record in progress
      const existingPerf = await client.query(
        `SELECT id FROM employee_case_performance
         WHERE ticket_id = $1 AND employee_id = $2 AND status = 'in_progress'`,
        [caseId, userId],
      );

      // Only create a performance record if one doesn't exist
      if (existingPerf.rows.length === 0) {
        const isValidUUID =
          jobTitleId &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            jobTitleId,
          );
        await client.query(
          `INSERT INTO employee_case_performance (ticket_id, employee_id, job_title_id, started_at, status)
           VALUES ($1, $2, $3, now(), 'in_progress')`,
          [caseId, userId, isValidUUID ? jobTitleId : null],
        );
      }

      await client.query("COMMIT");
      res.json({ success: true, caseId: caseId });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
    return res
      .status(400)
      .json({ error: "Missing jobTitleId or nextEmployeeId" });
  }

  try {
    const p = getPool();
    const client = await p.connect();

    try {
      await client.query("BEGIN");

      // Update ticket to transfer to next employee, record proceed time
      // Keep ticket in 'serving' status so it remains in active queue
      const updateRes = await client.query(
        `UPDATE tickets
         SET transferred_to_user_id = $1,
             transferred_at = now(),
             proceeded_at = now(),
             job_title_for_proceed = $2,
             status = 'serving'
         WHERE id = $3 AND transferred_to_user_id = $4
         RETURNING id`,
        [nextEmployeeId, jobTitleId, caseId, userId],
      );

      if (!updateRes.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Case not found or not assigned to you",
        });
      }

      // Record that current employee's performance ended with 'proceeded' status
      await client.query(
        `UPDATE employee_case_performance
         SET ended_at = now(), status = 'proceeded'
         WHERE ticket_id = $1 AND employee_id = $2 AND status = 'in_progress'`,
        [caseId, userId],
      );

      // DO NOT create a performance tracking entry for the next employee here.
      // The next employee will create their own entry when they click the Start button.
      // This ensures each employee has their own independent Start button state.

      await client.query("COMMIT");
      res.json({ success: true, caseId: caseId });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
    const client = await p.connect();

    try {
      await client.query("BEGIN");

      const completeRes = await client.query(
        `UPDATE tickets
         SET status = 'done',
             completed_at = now()
         WHERE id = $1 AND transferred_to_user_id = $2
         RETURNING id, completed_at`,
        [caseId, userId],
      );

      if (!completeRes.rows.length) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "Case not found or not assigned to you" });
      }

      // Record that current employee's performance ended with 'completed' status
      await client.query(
        `UPDATE employee_case_performance
         SET ended_at = now(), status = 'completed'
         WHERE ticket_id = $1 AND employee_id = $2 AND status = 'in_progress'`,
        [caseId, userId],
      );

      await client.query("COMMIT");
      res.json({
        success: true,
        completedAt: completeRes.rows[0].completed_at,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Failed to complete case:", error);
    res.status(500).json({
      error: "Failed to complete case. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const employeeHistory: RequestHandler = async (req, res) => {
  const userId = (req as any).auth?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  const timePeriod = (req.query.timePeriod || "today") as
    | "today"
    | "week"
    | "month";

  const p = getPool();

  try {
    // Determine the date threshold based on time period
    let dateThreshold = "date_trunc('day', now())"; // default: today
    if (timePeriod === "week") {
      dateThreshold = "date_trunc('week', now())";
    } else if (timePeriod === "month") {
      dateThreshold = "date_trunc('month', now())";
    }

    // Build the ticket selection query
    const selectTicketColumns = `t.id, t.service, t.number, t.code, t.status, t.window_id,
                extract(epoch from t.created_at)*1000 as created_at,
                extract(epoch from t.started_at)*1000 as started_at,
                extract(epoch from t.completed_at)*1000 as completed_at,
                t.notes, t.owner_name, t.woreda, t.remark, t.service_category, t.selected_services,
                t.transferred_from_window, t.transferred_to_window, t.transferred_to_user_id,
                extract(epoch from t.transferred_at)*1000 as transferred_at,
                t.started_by_user_id,
                extract(epoch from t.proceeded_at)*1000 as proceeded_at,
                t.job_title_for_proceed`;

    // Get all cases this employee started OR worked on within the selected time period
    // This includes:
    // 1. Cases they initiated (started_by_user_id)
    // 2. Cases they worked on (in employee_case_performance)
    // Include cases where creation, completion, or proceed happened within the time period
    const countRes = await p.query(
      `SELECT COUNT(DISTINCT t.id)::int AS total
       FROM tickets t
       LEFT JOIN employee_case_performance ecp ON t.id = ecp.ticket_id
       WHERE (t.started_by_user_id = $1 OR ecp.employee_id = $1)
         AND (t.created_at >= ${dateThreshold}
              OR t.completed_at >= ${dateThreshold}
              OR t.proceeded_at >= ${dateThreshold})`,
      [userId],
    );

    const { rows } = await p.query(
      `SELECT ${selectTicketColumns}
       FROM (
         SELECT DISTINCT t.id
         FROM tickets t
         LEFT JOIN employee_case_performance ecp ON t.id = ecp.ticket_id
         WHERE (t.started_by_user_id = $1 OR ecp.employee_id = $1)
           AND (t.created_at >= ${dateThreshold}
                OR t.completed_at >= ${dateThreshold}
                OR t.proceeded_at >= ${dateThreshold})
       ) distinct_tickets
       JOIN tickets t ON t.id = distinct_tickets.id
       ORDER BY COALESCE(t.proceeded_at, t.completed_at, t.started_at) DESC
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
    console.error("Failed to fetch case history:", error);
    res.status(500).json({
      error: "Failed to fetch case history. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const employeePerformanceMetrics: RequestHandler = async (req, res) => {
  const userId = (req as any).auth?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const ticketId = req.query.ticketId as string | undefined;
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const offset = Math.max(Number(req.query.offset || 0), 0);

  const p = getPool();

  try {
    let query = `
      SELECT
        ecp.id,
        ecp.ticket_id,
        ecp.employee_id,
        ecp.job_title_id,
        extract(epoch from ecp.started_at)*1000 as started_at,
        extract(epoch from ecp.ended_at)*1000 as ended_at,
        ecp.status,
        EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at)) as duration_seconds,
        u.username,
        u.full_name,
        t.code as ticket_code,
        COALESCE(jt.name_english, jt.name_amharic, 'No Title') as job_title_name
      FROM employee_case_performance ecp
      LEFT JOIN users u ON ecp.employee_id = u.id
      LEFT JOIN tickets t ON ecp.ticket_id = t.id
      LEFT JOIN job_title jt ON ecp.job_title_id = jt.id
      WHERE ecp.employee_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (ticketId) {
      query += ` AND ecp.ticket_id = $${paramIndex}`;
      params.push(ticketId);
      paramIndex++;
    }

    // Get total count
    const countRes = await p.query(
      `SELECT COUNT(*)::int AS total FROM employee_case_performance WHERE employee_id = $1${ticketId ? ` AND ticket_id = $2` : ""}`,
      ticketId ? [userId, ticketId] : [userId],
    );

    query += ` ORDER BY ecp.started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const { rows } = await p.query(query, params);

    const items = rows.map((r) => ({
      id: r.id,
      ticketId: r.ticket_id,
      employeeId: r.employee_id,
      jobTitleId: r.job_title_id,
      startedAt: r.started_at ? Math.round(r.started_at) : null,
      endedAt: r.ended_at ? Math.round(r.ended_at) : null,
      status: r.status,
      durationSeconds: r.duration_seconds
        ? Math.round(r.duration_seconds)
        : null,
      employeeName: r.full_name || r.username,
      jobTitle: r.job_title_name || "No Title",
      ticketCode: r.ticket_code,
    }));

    // If ticketId is provided, calculate the sum of all employees' durations for that ticket
    let sumEmployeesDurationSeconds: number | null = null;
    if (ticketId) {
      const sumRes = await p.query(
        `SELECT SUM(EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at))) as total_duration
         FROM employee_case_performance ecp
         WHERE ecp.ticket_id = $1
           AND ecp.ended_at IS NOT NULL`,
        [ticketId],
      );
      sumEmployeesDurationSeconds = sumRes.rows[0]?.total_duration
        ? Math.round(Number(sumRes.rows[0].total_duration))
        : null;
    }

    res.json({
      items,
      total: Number(countRes.rows[0]?.total || 0),
      sumEmployeesDurationSeconds,
    });
  } catch (error) {
    console.error("Failed to fetch performance metrics:", error);
    res.status(500).json({
      error: "Failed to fetch performance metrics. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Public endpoint for viewing case workflow (used by supervisors and tellers)
export const caseWorkflow: RequestHandler = async (req, res) => {
  const ticketId = req.query.ticketId as string | undefined;

  if (!ticketId) {
    return res.status(400).json({ error: "Missing ticketId parameter" });
  }

  const p = getPool();

  try {
    // Fetch employee workflow entries for this ticket
    const workflowRes = await p.query(
      `SELECT
         ecp.id,
         ecp.ticket_id,
         ecp.employee_id,
         ecp.job_title_id,
         extract(epoch from ecp.started_at)*1000 as started_at,
         extract(epoch from ecp.ended_at)*1000 as ended_at,
         ecp.status,
         EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at)) as duration_seconds,
         u.username,
         u.full_name,
         t.code as ticket_code,
         t.service_category,
         t.selected_services,
         COALESCE(jt.name_english, jt.name_amharic, jt2.name_english, jt2.name_amharic, 'N/A') as job_title_name
       FROM employee_case_performance ecp
       LEFT JOIN users u ON ecp.employee_id = u.id
       LEFT JOIN tickets t ON ecp.ticket_id = t.id
       LEFT JOIN job_title jt ON ecp.job_title_id = jt.id
       LEFT JOIN job_title jt2 ON u.job_title_id = jt2.id
       WHERE ecp.ticket_id = $1
       ORDER BY ecp.started_at ASC`,
      [ticketId],
    );

    // Fetch archiver information for this ticket
    const archiverRes = await p.query(
      `SELECT
         t.id as ticket_id,
         t.archived_by_user_id,
         u.full_name,
         u.username,
         extract(epoch from t.archiver_started_at)*1000 as started_at,
         extract(epoch from t.documents_fetched_at)*1000 as ended_at,
         EXTRACT(EPOCH FROM (t.documents_fetched_at - t.archiver_started_at)) as duration_seconds,
         jt.name_english,
         jt.name_amharic
       FROM tickets t
       LEFT JOIN users u ON t.archived_by_user_id = u.id
       LEFT JOIN job_title jt ON u.job_title_id = jt.id
       WHERE t.id = $1
         AND t.archiver_started_at IS NOT NULL
         AND t.documents_fetched_at IS NOT NULL`,
      [ticketId],
    );

    // Fetch teller information for this ticket
    // Get the ticket's basic info first
    const ticketTellerRes = await p.query(
      `SELECT
         t.id as ticket_id,
         t.window_id,
         extract(epoch from t.created_at)*1000 as created_at,
         extract(epoch from t.started_at)*1000 as started_at,
         EXTRACT(EPOCH FROM (t.started_at - t.created_at)) as duration_seconds
       FROM tickets t
       WHERE t.id = $1
         AND t.window_id IS NOT NULL
         AND t.started_at IS NOT NULL`,
      [ticketId],
    );

    // Then get the user who was logged in at that window during that time
    let tellerRes = { rows: [] };
    if (ticketTellerRes.rows.length > 0) {
      const ticketData = ticketTellerRes.rows[0];
      const userRes = await p.query(
        `SELECT
           us.user_id,
           u.full_name,
           u.username,
           jt.name_english,
           jt.name_amharic
         FROM user_sessions us
         LEFT JOIN users u ON us.user_id = u.id
         LEFT JOIN job_title jt ON u.job_title_id = jt.id
         WHERE us.window_id = $1
           AND us.active_role = 'teller'
           AND us.created_at <= to_timestamp($2 / 1000)
           AND (us.revoked_at IS NULL OR us.revoked_at >= to_timestamp($2 / 1000))
         ORDER BY us.created_at DESC
         LIMIT 1`,
        [ticketData.window_id, ticketData.started_at],
      );

      // Merge the ticket data with the user session data
      if (userRes.rows.length > 0) {
        tellerRes.rows = [{
          ...ticketData,
          ...userRes.rows[0],
        }];
      } else {
        // No user session found, but we still want to record the teller step with just ticket data
        tellerRes.rows = [ticketData];
      }
    }

    // Get ticket info for service enrichment
    const ticketRes = await p.query(
      `SELECT code, service_category, selected_services FROM tickets WHERE id = $1`,
      [ticketId],
    );

    const ticket = ticketRes.rows[0];

    // Enrich selected services with names
    let enrichedServices: string[] | undefined = undefined;
    if (ticket && ticket.selected_services && ticket.service_category) {
      const selectedServiceIds = parseSelectedServices(
        ticket.selected_services,
      );
      if (selectedServiceIds && selectedServiceIds.length > 0) {
        try {
          const tempTicket = {
            selectedServices: selectedServiceIds,
            serviceCategory: ticket.service_category,
          } as any;

          const enrichedTickets = await enrichMultipleTicketsWithServiceNames([
            tempTicket,
          ]);
          enrichedServices = enrichedTickets[0]?.selectedServices;
        } catch (enrichError) {
          console.warn("Failed to enrich services with names:", enrichError);
          enrichedServices = selectedServiceIds;
        }
      }
    }

    const ticketInfo = ticket
      ? {
          ticketCode: ticket.code,
          serviceCategory: ticket.service_category,
          selectedServices: enrichedServices,
        }
      : null;

    const items: any[] = [];

    // Add archiver step first if available
    const archiverData = archiverRes.rows[0];
    if (archiverData && archiverData.started_at && archiverData.ended_at) {
      items.push({
        id: `archiver-${ticketId}`,
        ticketId: ticketId,
        employeeId: archiverData.archived_by_user_id,
        jobTitleId: null,
        startedAt: archiverData.started_at
          ? Math.round(archiverData.started_at)
          : null,
        endedAt: archiverData.ended_at
          ? Math.round(archiverData.ended_at)
          : null,
        status: "completed",
        durationSeconds: archiverData.duration_seconds
          ? Math.round(archiverData.duration_seconds)
          : null,
        employeeName:
          archiverData.full_name || archiverData.username || "Unknown Archiver",
        jobTitle:
          archiverData.name_english || archiverData.name_amharic || "Archiver",
        ticketCode: ticketId,
        isArchiver: true,
      });
    }

    // Add teller step second if available
    const tellerData = tellerRes.rows[0];
    if (tellerData && tellerData.started_at) {
      // Calculate teller's end time: when the first employee started
      let tellerEndTime = null;
      let tellerDuration = null;
      if (workflowRes.rows.length > 0 && workflowRes.rows[0].started_at) {
        tellerEndTime = Math.round(workflowRes.rows[0].started_at);
        tellerDuration = Math.round(
          (tellerEndTime - Math.round(tellerData.started_at)) / 1000,
        );
      }

      items.push({
        id: `teller-${ticketId}`,
        ticketId: ticketId,
        employeeId: tellerData.user_id,
        jobTitleId: null,
        startedAt: tellerData.started_at
          ? Math.round(tellerData.started_at)
          : null,
        endedAt: tellerEndTime,
        status: "completed",
        durationSeconds: tellerDuration,
        employeeName:
          tellerData.full_name || tellerData.username || "Unknown Teller",
        jobTitle:
          tellerData.name_english || tellerData.name_amharic || "Teller",
        ticketCode: ticketId,
        isTeller: true,
      });
    }

    // Add employee workflow steps
    workflowRes.rows.forEach((r) => {
      items.push({
        id: r.id,
        ticketId: r.ticket_id,
        employeeId: r.employee_id,
        jobTitleId: r.job_title_id,
        startedAt: r.started_at ? Math.round(r.started_at) : null,
        endedAt: r.ended_at ? Math.round(r.ended_at) : null,
        status: r.status,
        durationSeconds: r.duration_seconds
          ? Math.round(r.duration_seconds)
          : null,
        employeeName: r.full_name || r.username || "Unknown",
        jobTitle: r.job_title_name,
        ticketCode: r.ticket_code,
      });
    });

    res.json({
      items,
      ticketInfo,
      total: items.length,
    });
  } catch (error) {
    console.error("Failed to fetch case workflow:", error);
    res.status(500).json({
      error: "Failed to fetch case workflow. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Endpoint for listing completed case workflows with pagination and timeframe filtering
export const listCaseWorkflows: RequestHandler = async (req, res) => {
  const timeframe = (req.query.timeframe || "today") as
    | "today"
    | "week"
    | "month";
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
  const offset = Math.max(Number(req.query.offset || 0), 0);

  const p = getPool();

  try {
    // Determine the date threshold based on timeframe
    let dateThreshold = "date_trunc('day', now())"; // default: today
    if (timeframe === "week") {
      dateThreshold = "date_trunc('week', now())";
    } else if (timeframe === "month") {
      dateThreshold = "date_trunc('month', now())";
    }

    // Get count of completed cases with at least one workflow entry
    const countRes = await p.query(
      `SELECT COUNT(DISTINCT t.id)::int AS total
       FROM tickets t
       JOIN employee_case_performance ecp ON t.id = ecp.ticket_id
       WHERE t.status = 'done'
         AND t.completed_at >= ${dateThreshold}`,
    );

    // Get list of distinct completed ticket IDs (paginated)
    const ticketRes = await p.query(
      `SELECT DISTINCT ON (t.id) t.id, t.code, t.completed_at
       FROM tickets t
       JOIN employee_case_performance ecp ON t.id = ecp.ticket_id
       WHERE t.status = 'done'
         AND t.completed_at >= ${dateThreshold}
       ORDER BY t.id, t.completed_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const ticketIds = ticketRes.rows.map((row) => row.id);

    if (ticketIds.length === 0) {
      return res.json({
        items: [],
        total: Number(countRes.rows[0]?.total || 0),
      });
    }

    // Fetch workflow entries for all tickets in this page
    const workflowRes = await p.query(
      `SELECT
         ecp.id,
         ecp.ticket_id,
         ecp.employee_id,
         ecp.job_title_id,
         extract(epoch from ecp.started_at)*1000 as started_at,
         extract(epoch from ecp.ended_at)*1000 as ended_at,
         ecp.status,
         EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at)) as duration_seconds,
         u.username,
         u.full_name,
         t.code as ticket_code,
         t.service_category,
         t.selected_services,
         COALESCE(jt.name_english, jt.name_amharic, jt2.name_english, jt2.name_amharic, 'N/A') as job_title_name
       FROM employee_case_performance ecp
       LEFT JOIN users u ON ecp.employee_id = u.id
       LEFT JOIN tickets t ON ecp.ticket_id = t.id
       LEFT JOIN job_title jt ON ecp.job_title_id = jt.id
       LEFT JOIN job_title jt2 ON u.job_title_id = jt2.id
       WHERE ecp.ticket_id = ANY($1)
       ORDER BY ecp.ticket_id, ecp.started_at ASC`,
      [ticketIds],
    );

    // Fetch archiever information for all tickets
    const archiverRes = await p.query(
      `SELECT
         t.id as ticket_id,
         t.archived_by_user_id,
         u.full_name,
         u.username,
         extract(epoch from t.archiver_started_at)*1000 as started_at,
         extract(epoch from t.documents_fetched_at)*1000 as ended_at,
         EXTRACT(EPOCH FROM (t.documents_fetched_at - t.archiver_started_at)) as duration_seconds,
         jt.name_english,
         jt.name_amharic
       FROM tickets t
       LEFT JOIN users u ON t.archived_by_user_id = u.id
       LEFT JOIN job_title jt ON u.job_title_id = jt.id
       WHERE t.id = ANY($1)
         AND t.archiver_started_at IS NOT NULL
         AND t.documents_fetched_at IS NOT NULL`,
      [ticketIds],
    );

    // Fetch teller information for all tickets
    // Get basic ticket info first
    const ticketTellerDataRes = await p.query(
      `SELECT
         t.id as ticket_id,
         t.window_id,
         extract(epoch from t.created_at)*1000 as created_at,
         extract(epoch from t.started_at)*1000 as started_at,
         EXTRACT(EPOCH FROM (t.started_at - t.created_at)) as duration_seconds
       FROM tickets t
       WHERE t.id = ANY($1)
         AND t.window_id IS NOT NULL
         AND t.started_at IS NOT NULL`,
      [ticketIds],
    );

    // Then get user sessions for those tickets
    const userSessionsRes = await p.query(
      `SELECT DISTINCT ON (t.id)
         t.id as ticket_id,
         us.user_id,
         u.full_name,
         u.username,
         jt.name_english,
         jt.name_amharic
       FROM tickets t
       LEFT JOIN user_sessions us ON us.window_id = t.window_id
         AND us.active_role = 'teller'
         AND us.created_at <= t.started_at
         AND (us.revoked_at IS NULL OR us.revoked_at >= t.started_at)
       LEFT JOIN users u ON us.user_id = u.id
       LEFT JOIN job_title jt ON u.job_title_id = jt.id
       WHERE t.id = ANY($1)
         AND t.window_id IS NOT NULL
         AND t.started_at IS NOT NULL
       ORDER BY t.id, us.created_at DESC`,
      [ticketIds],
    );

    // Merge the data
    const tellerRes = {
      rows: ticketTellerDataRes.rows.map((ticketRow) => {
        const userSessionRow = userSessionsRes.rows.find(
          (ur) => ur.ticket_id === ticketRow.ticket_id
        );
        return {
          ...ticketRow,
          ...(userSessionRow || {}),
        };
      }),
    };

    // Group workflow entries by ticket
    const workflowsByTicket = new Map<string, any[]>();
    workflowRes.rows.forEach((row) => {
      if (!workflowsByTicket.has(row.ticket_id)) {
        workflowsByTicket.set(row.ticket_id, []);
      }
      workflowsByTicket.get(row.ticket_id)!.push(row);
    });

    // Group archiever entries by ticket
    const archiverByTicket = new Map<string, any>();
    archiverRes.rows.forEach((row) => {
      if (row.ticket_id) {
        archiverByTicket.set(row.ticket_id, row);
      }
    });

    // Group teller entries by ticket
    const tellerByTicket = new Map<string, any>();
    tellerRes.rows.forEach((row) => {
      if (row.ticket_id) {
        tellerByTicket.set(row.ticket_id, row);
      }
    });

    // Build response items with workflows grouped by ticket
    const items = await Promise.all(
      ticketIds.map(async (ticketId) => {
        const workflowRows = workflowsByTicket.get(ticketId) || [];

        // Enrich selected services with names
        let enrichedServices: string[] | undefined = undefined;
        if (
          workflowRows.length > 0 &&
          workflowRows[0].selected_services &&
          workflowRows[0].service_category
        ) {
          const selectedServiceIds = parseSelectedServices(
            workflowRows[0].selected_services,
          );
          if (selectedServiceIds && selectedServiceIds.length > 0) {
            try {
              const tempTicket = {
                selectedServices: selectedServiceIds,
                serviceCategory: workflowRows[0].service_category,
              } as any;

              const enrichedTickets =
                await enrichMultipleTicketsWithServiceNames([tempTicket]);
              enrichedServices = enrichedTickets[0]?.selectedServices;
            } catch (enrichError) {
              console.warn(
                "Failed to enrich services with names:",
                enrichError,
              );
              enrichedServices = selectedServiceIds;
            }
          }
        }

        const ticketInfo =
          workflowRows.length > 0
            ? {
                ticketCode: workflowRows[0].ticket_code,
                serviceCategory: workflowRows[0].service_category,
                selectedServices: enrichedServices,
              }
            : null;

        const workflowItems: any[] = [];

        // Add archiever step first if available
        const archiverData = archiverByTicket.get(ticketId);
        if (archiverData && archiverData.started_at && archiverData.ended_at) {
          workflowItems.push({
            id: `archiver-${ticketId}`,
            ticketId: ticketId,
            employeeId: archiverData.archived_by_user_id,
            jobTitleId: null,
            startedAt: archiverData.started_at
              ? Math.round(archiverData.started_at)
              : null,
            endedAt: archiverData.ended_at
              ? Math.round(archiverData.ended_at)
              : null,
            status: "completed",
            durationSeconds: archiverData.duration_seconds
              ? Math.round(archiverData.duration_seconds)
              : null,
            employeeName:
              archiverData.full_name ||
              archiverData.username ||
              "Unknown Archiever",
            jobTitle:
              archiverData.name_english ||
              archiverData.name_amharic ||
              "Archiever",
            ticketCode: ticketId,
            isArchiever: true,
          });
        }

        // Add teller step second if available
        const tellerData = tellerByTicket.get(ticketId);
        if (tellerData && tellerData.started_at) {
          // Calculate teller's end time: when the first employee started
          let tellerEndTime = null;
          let tellerDuration = null;
          if (workflowRows.length > 0 && workflowRows[0].started_at) {
            tellerEndTime = Math.round(workflowRows[0].started_at);
            tellerDuration = Math.round(
              (tellerEndTime - Math.round(tellerData.started_at)) / 1000,
            );
          }

          workflowItems.push({
            id: `teller-${ticketId}`,
            ticketId: ticketId,
            employeeId: tellerData.user_id,
            jobTitleId: null,
            startedAt: tellerData.started_at
              ? Math.round(tellerData.started_at)
              : null,
            endedAt: tellerEndTime,
            status: "completed",
            durationSeconds: tellerDuration,
            employeeName:
              tellerData.full_name || tellerData.username || "Unknown Teller",
            jobTitle:
              tellerData.name_english || tellerData.name_amharic || "Teller",
            ticketCode: ticketId,
            isTeller: true,
          });
        }

        // Add employee workflow steps
        workflowRows.forEach((r) => {
          workflowItems.push({
            id: r.id,
            ticketId: r.ticket_id,
            employeeId: r.employee_id,
            jobTitleId: r.job_title_id,
            startedAt: r.started_at ? Math.round(r.started_at) : null,
            endedAt: r.ended_at ? Math.round(r.ended_at) : null,
            status: r.status,
            durationSeconds: r.duration_seconds
              ? Math.round(r.duration_seconds)
              : null,
            employeeName: r.full_name || r.username || "Unknown",
            jobTitle: r.job_title_name,
            ticketCode: r.ticket_code,
            isArchiever: false,
          });
        });

        // Calculate total duration from first step to last step
        let totalDuration = null;
        if (workflowItems.length > 0) {
          const first = workflowItems[0];
          const last = workflowItems[workflowItems.length - 1];
          if (first.startedAt && last.endedAt) {
            totalDuration = (last.endedAt - first.startedAt) / 1000;
          }
        }

        return {
          ticketId,
          ticketCode: ticketInfo?.ticketCode,
          ticketInfo,
          items: workflowItems,
          totalDuration,
        };
      }),
    );

    res.json({
      items,
      total: Number(countRes.rows[0]?.total || 0),
    });
  } catch (error) {
    console.error("Failed to fetch case workflows:", error);
    res.status(500).json({
      error: "Failed to fetch case workflows. Please try again later.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

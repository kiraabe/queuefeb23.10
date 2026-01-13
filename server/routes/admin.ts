import type { RequestHandler } from "express";
import { getPool, isDbEnabled } from "../store/db";
import {
  listServiceCategoriesDb,
  getServicesByCategoryDb,
  getWindowServicesDb,
  setWindowServicesDb,
  createServiceCategoryDb,
  updateServiceCategoryDb,
  deleteServiceCategoryDb,
  createServiceDb,
  updateServiceDb,
  deleteServiceDb,
} from "../store/db";
import type {
  GetQueueSettingsResponse,
  UpdateQueueSettingsRequest,
  UpdateQueueSettingsResponse,
  QueueSettings,
  ListServiceCategoriesResponse,
  GetCategoryServicesResponse,
} from "@shared/api";

// Define logAudit as a stub since it's used but not fully defined
const logAudit = async (params: any) => {
  // Audit logging stub
  console.debug("Audit:", params);
};

export const clearDemo: RequestHandler = async (_req, res) => {
  if (!isDbEnabled) return res.status(400).json({ error: "DB not enabled" });
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    // Remove all tickets
    await client.query(`DELETE FROM tickets;`);
    // Reset windows to idle
    await client.query(
      `UPDATE windows SET current_ticket_id=NULL, busy=false, updated_at=now();`,
    );
    // Reset service counters
    await client.query(
      `UPDATE service_counters SET next_number = 1, counter_date = current_date;`,
    );
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("Failed to clear demo data", e);
    res.status(500).json({ error: "Failed to clear demo data" });
  } finally {
    client.release();
  }
};

export const seedTestData: RequestHandler = async (_req, res) => {
  if (!isDbEnabled) return res.status(400).json({ error: "DB not enabled" });
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Get a few users to assign as employees
    const usersRes = await client.query(
      `SELECT id, job_title_id FROM users WHERE role = 'employee' LIMIT 3`,
    );
    const employees = usersRes.rows;

    if (employees.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "No employees found. Please create employee users first.",
      });
    }

    // Get service categories
    const categoriesRes = await client.query(
      `SELECT id FROM service_categories LIMIT 1`,
    );
    const category = categoriesRes.rows[0];

    if (!category) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "No service categories found.",
      });
    }

    // Create completed tickets with workflows for different timeframes
    const testCases = [
      {
        name: "Today Case 1",
        daysAgo: 0,
        hoursAgo: 2,
      },
      {
        name: "Today Case 2",
        daysAgo: 0,
        hoursAgo: 4,
      },
      {
        name: "This Week Case",
        daysAgo: 3,
        hoursAgo: 0,
      },
      {
        name: "This Month Case",
        daysAgo: 15,
        hoursAgo: 0,
      },
    ];

    const createdTickets = [];

    for (let caseIndex = 0; caseIndex < testCases.length; caseIndex++) {
      const testCase = testCases[caseIndex];
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - testCase.daysAgo);
      createdAt.setHours(createdAt.getHours() - testCase.hoursAgo);

      const completedAt = new Date(createdAt);
      completedAt.setHours(completedAt.getHours() + 1);

      // Create a test ticket
      const ticketId = (await import("node:crypto")).randomUUID();
      const number = Math.floor(Math.random() * 1000);
      const code = `TST-${number}`;

      // Assign to a window and set timestamps in order:
      // 1. Archiver retrieves documents (starts at creation, ends 1 min after)
      // 2. Teller processes at window (starts 1 min after, ends 3 min after)
      // 3. Employees process (starts 3 min after, ends with completion)
      const windowId = (caseIndex % 6) + 1; // Assign to windows 1-6

      const archiverStartedAt = new Date(createdAt);
      const documentsFetchedAt = new Date(createdAt);
      documentsFetchedAt.setMinutes(documentsFetchedAt.getMinutes() + 1);

      const startedAt = new Date(createdAt);
      startedAt.setMinutes(startedAt.getMinutes() + 1);

      await client.query(
        `INSERT INTO tickets (id, code, number, service, status, created_at, started_at, completed_at, started_by_user_id, transferred_to_user_id, owner_name, service_category, required_documents, window_id, archived_by_user_id, archiver_started_at, documents_fetched_at)
         VALUES ($1, $2, $3, 'general', 'done', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          ticketId,
          code,
          number,
          createdAt,
          startedAt,
          completedAt,
          employees[0].id,
          employees[0].id,
          `Customer ${number}`,
          category.id,
          null,
          windowId,
          employees[0].id,
          archiverStartedAt,
          documentsFetchedAt,
        ],
      );

      // Create workflow entries for this ticket (one per employee)
      let stepStartTime = createdAt;
      for (let i = 0; i < employees.length; i++) {
        const stepEndTime = new Date(stepStartTime);
        stepEndTime.setMinutes(stepEndTime.getMinutes() + (i + 1) * 5);

        await client.query(
          `INSERT INTO employee_case_performance (ticket_id, employee_id, job_title_id, started_at, ended_at, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            ticketId,
            employees[i].id,
            employees[i].job_title_id,
            stepStartTime,
            stepEndTime,
            i === employees.length - 1 ? "completed" : "proceeded",
          ],
        );

        stepStartTime = new Date(stepEndTime);
      }

      createdTickets.push({ id: ticketId, code, name: testCase.name });
    }

    await client.query("COMMIT");
    res.json({
      ok: true,
      message: "Test data created successfully",
      ticketsCreated: createdTickets.length,
      tickets: createdTickets,
    });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("Failed to seed test data", e);
    res.status(500).json({
      error: "Failed to seed test data",
      details: e instanceof Error ? e.message : String(e),
    });
  } finally {
    client.release();
  }
};

export const getQueueSettings: RequestHandler = async (_req, res) => {
  if (!isDbEnabled) {
    return res.status(200).json({
      settings: {
        maxTicketsPerDay: 200,
        dailyResetTimeUtc: "00:00",
        fifoMode: true,
        enableTicketTransfers: true,
      },
    } as GetQueueSettingsResponse);
  }

  try {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT
        max_tickets_per_day,
        daily_reset_time_utc,
        fifo_mode,
        enable_ticket_transfers,
        extract(epoch from updated_at)*1000 as updated_at
      FROM queue_settings WHERE id = 1`,
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Queue settings not found" });
    }

    const row = rows[0];
    const settings: QueueSettings = {
      maxTicketsPerDay: row.max_tickets_per_day,
      dailyResetTimeUtc: row.daily_reset_time_utc,
      fifoMode: row.fifo_mode,
      enableTicketTransfers: row.enable_ticket_transfers,
      updatedAt: Math.round(Number(row.updated_at)),
    };

    res.json({ settings } as GetQueueSettingsResponse);
  } catch (error) {
    console.error("Failed to get queue settings", error);
    res.status(500).json({ error: "Failed to get queue settings" });
  }
};

export const updateQueueSettings: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(200).json({
      settings: req.body,
      message: "Settings saved successfully (in-memory)",
    } as UpdateQueueSettingsResponse);
  }

  try {
    const {
      maxTicketsPerDay,
      dailyResetTimeUtc,
      fifoMode,
      enableTicketTransfers,
    } = req.body as UpdateQueueSettingsRequest;

    // Validate input
    if (
      typeof maxTicketsPerDay !== "number" ||
      maxTicketsPerDay < 1 ||
      maxTicketsPerDay > 1000
    ) {
      return res.status(400).json({
        error: "Invalid maxTicketsPerDay. Must be between 1 and 1000",
      });
    }

    if (typeof dailyResetTimeUtc !== "string") {
      return res.status(400).json({
        error: "Invalid dailyResetTimeUtc. Must be a time string (HH:MM)",
      });
    }

    // Validate time format HH:MM
    if (!/^\d{2}:\d{2}$/.test(dailyResetTimeUtc)) {
      return res.status(400).json({
        error: "Invalid time format. Use HH:MM (00:00 - 23:59)",
      });
    }

    const p = getPool();
    const { rows } = await p.query(
      `UPDATE queue_settings
       SET
         max_tickets_per_day = $1,
         daily_reset_time_utc = $2,
         fifo_mode = $3,
         enable_ticket_transfers = $4,
         updated_at = now()
       WHERE id = 1
       RETURNING
         max_tickets_per_day,
         daily_reset_time_utc,
         fifo_mode,
         enable_ticket_transfers,
         extract(epoch from updated_at)*1000 as updated_at`,
      [maxTicketsPerDay, dailyResetTimeUtc, fifoMode, enableTicketTransfers],
    );

    if (!rows.length) {
      return res.status(500).json({ error: "Failed to update queue settings" });
    }

    const row = rows[0];
    const settings: QueueSettings = {
      maxTicketsPerDay: row.max_tickets_per_day,
      dailyResetTimeUtc: row.daily_reset_time_utc,
      fifoMode: row.fifo_mode,
      enableTicketTransfers: row.enable_ticket_transfers,
      updatedAt: Math.round(Number(row.updated_at)),
    };

    res.json({
      settings,
      message: "Queue settings updated successfully",
    } as UpdateQueueSettingsResponse);
  } catch (error) {
    console.error("Failed to update queue settings", error);
    res.status(500).json({ error: "Failed to update queue settings" });
  }
};

export const getDailyReport: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "Database not enabled" });
  }

  try {
    const p = getPool();

    // Parse date range from query parameters
    let fromDate: string;
    let toDate: string;

    if (req.query.fromDate && req.query.toDate) {
      // User specified date range - already in ISO format from frontend
      fromDate = req.query.fromDate as string;
      toDate = req.query.toDate as string;
      console.log("[getDailyReport] Received date range from frontend:", {
        fromDate,
        toDate,
      });
    } else {
      // Default to today only
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      fromDate = today.toISOString();

      const todayEnd = new Date(today);
      todayEnd.setUTCHours(23, 59, 59, 999);
      toDate = todayEnd.toISOString();
      console.log("[getDailyReport] Using default date range (today):", {
        fromDate,
        toDate,
      });
    }

    // Get skipped tickets with details
    const skippedRes = await p.query(
      `SELECT
        t.id,
        t.code,
        t.service,
        t.number,
        extract(epoch from t.created_at)*1000 as created_at,
        extract(epoch from t.skipped_at)*1000 as skipped_at,
        t.skipped_by_window,
        w.name as skipped_by_window_name,
        t.remark
      FROM tickets t
      LEFT JOIN windows w ON t.skipped_by_window = w.id
      WHERE t.status = 'skipped'
        AND t.created_at >= $1
        AND t.created_at <= $2
      ORDER BY t.skipped_at DESC`,
      [fromDate, toDate],
    );

    // Get transfer history with details
    const transfersRes = await p.query(
      `SELECT
        th.id,
        t.id as ticket_id,
        t.code,
        t.service,
        t.number,
        extract(epoch from t.created_at)*1000 as created_at,
        extract(epoch from th.transferred_at)*1000 as transferred_at,
        th.from_window,
        wf.name as from_window_name,
        th.to_window,
        wt.name as to_window_name,
        t.remark
      FROM transfer_history th
      JOIN tickets t ON t.id = th.ticket_id
      LEFT JOIN windows wf ON th.from_window = wf.id
      LEFT JOIN windows wt ON th.to_window = wt.id
      WHERE t.created_at >= $1
        AND t.created_at <= $2
      ORDER BY th.transferred_at DESC`,
      [fromDate, toDate],
    );

    // Get all tickets created in the date range
    const allTicketsRes = await p.query(
      `SELECT
        t.id,
        t.code,
        t.service,
        t.status,
        t.window_id,
        w.name as window_name,
        extract(epoch from t.created_at)*1000 as created_at,
        extract(epoch from t.completed_at)*1000 as completed_at
      FROM tickets t
      LEFT JOIN windows w ON t.window_id = w.id
      WHERE t.created_at >= $1
        AND t.created_at <= $2
      ORDER BY t.created_at ASC`,
      [fromDate, toDate],
    );

    // Get window statistics with assigned teller (show teller who served tickets in date range or is assigned to window)
    const windowStatsRes = await p.query(
      `WITH window_served_tickets AS (
        SELECT w.id as window_id, COUNT(DISTINCT t.id) as served_count
        FROM windows w
        LEFT JOIN tickets t ON (
          t.window_id = w.id
          OR EXISTS (SELECT 1 FROM transfer_history th WHERE th.to_window = w.id AND th.ticket_id = t.id)
        )
        WHERE t.status = 'done' AND t.created_at >= $1::timestamptz AND t.created_at <= $2::timestamptz
        GROUP BY w.id
      ),
      window_skipped_tickets AS (
        SELECT w.id as window_id, COUNT(DISTINCT t.id) as skipped_count
        FROM windows w
        LEFT JOIN tickets t ON t.skipped_by_window = w.id
        WHERE t.status = 'skipped' AND t.created_at >= $1::timestamptz AND t.created_at <= $2::timestamptz
        GROUP BY w.id
      ),
      window_transfers_from AS (
        SELECT th.from_window as window_id, COUNT(DISTINCT th.id) as transfers_from_count
        FROM transfer_history th
        JOIN tickets t ON t.id = th.ticket_id
        WHERE t.created_at >= $1::timestamptz AND t.created_at <= $2::timestamptz
        GROUP BY th.from_window
      ),
      window_transfers_to AS (
        SELECT th.to_window as window_id, COUNT(DISTINCT th.id) as transfers_to_count
        FROM transfer_history th
        JOIN tickets t ON t.id = th.ticket_id
        WHERE t.created_at >= $1::timestamptz AND t.created_at <= $2::timestamptz
        GROUP BY th.to_window
      ),
      window_avg_service_time AS (
        SELECT w.id as window_id,
          ROUND(AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))))::int as avg_time
        FROM windows w
        LEFT JOIN tickets t ON (
          (t.window_id = w.id OR EXISTS (SELECT 1 FROM transfer_history th WHERE th.to_window = w.id AND th.ticket_id = t.id))
          AND t.status = 'done'
          AND t.created_at >= $1::timestamptz
          AND t.created_at <= $2::timestamptz
          AND t.completed_at IS NOT NULL
          AND t.started_at IS NOT NULL
        )
        GROUP BY w.id
      )
      SELECT
        w.id,
        w.name,
        COALESCE(
          (SELECT u.full_name FROM tickets t
           JOIN employee_case_performance ecp ON t.id = ecp.ticket_id
           JOIN users u ON ecp.employee_id = u.id
           WHERE t.window_id = w.id AND t.created_at >= $1::timestamptz AND t.created_at <= $2::timestamptz
           ORDER BY ecp.ended_at DESC LIMIT 1),
          (SELECT u.full_name FROM users u
           WHERE u.window_id = w.id LIMIT 1),
          'Unassigned'
        ) as teller_name,
        COALESCE(wst.served_count, 0)::int as served,
        COALESCE(ws.skipped_count, 0)::int as skipped,
        COALESCE(wtf.transfers_from_count, 0)::int as transfers_from,
        COALESCE(wtt.transfers_to_count, 0)::int as transfers_to,
        COALESCE(wast.avg_time, NULL)::int as avg_service_time
      FROM windows w
      LEFT JOIN window_served_tickets wst ON wst.window_id = w.id
      LEFT JOIN window_skipped_tickets ws ON ws.window_id = w.id
      LEFT JOIN window_transfers_from wtf ON wtf.window_id = w.id
      LEFT JOIN window_transfers_to wtt ON wtt.window_id = w.id
      LEFT JOIN window_avg_service_time wast ON wast.window_id = w.id
      ORDER BY w.id`,
      [fromDate, toDate],
    );

    console.log("[getDailyReport] Window stats query result:", {
      rowCount: windowStatsRes.rows?.length || 0,
      rows: windowStatsRes.rows?.slice(0, 3), // Log first 3 rows for debugging
    });

    // Get total tickets created in the date range
    const totalTicketsRes = await p.query(
      `SELECT COUNT(*)::int as total FROM tickets WHERE created_at >= $1 AND created_at <= $2`,
      [fromDate, toDate],
    );

    // Get summary statistics
    const summaryRes = await p.query(
      `SELECT
        COUNT(CASE WHEN status = 'done' THEN 1 END)::int as served,
        COUNT(CASE WHEN status = 'skipped' THEN 1 END)::int as skipped,
        COUNT(CASE WHEN status = 'transferred' THEN 1 END)::int as transferred,
        COUNT(*)::int as total,
        ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))))::int as avg_service_time
      FROM tickets
      WHERE created_at >= $1 AND created_at <= $2`,
      [fromDate, toDate],
    );

    const summary = summaryRes.rows[0] || {};
    console.log("[getDailyReport] Summary statistics:", {
      dateRange: { fromDate, toDate },
      summary,
      windowStatsCount: windowStatsRes.rows?.length || 0,
      allTicketsCount: allTicketsRes.rows?.length || 0,
      skippedCount: skippedRes.rows?.length || 0,
      transfersCount: transfersRes.rows?.length || 0,
    });

    // Format report date range
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    const fromDateStr = fromDateObj.toISOString().split("T")[0];
    const toDateStr = toDateObj.toISOString().split("T")[0];
    const reportDate =
      fromDateStr === toDateStr
        ? fromDateStr
        : `${fromDateStr} to ${toDateStr}`;

    // Get employee case performance data for the date range
    const employeePerfRes = await p.query(
      `SELECT
        ecp.employee_id,
        u.full_name,
        u.username,
        COUNT(DISTINCT ecp.id) as total_cases_started,
        COUNT(DISTINCT CASE WHEN ecp.status = 'completed' THEN ecp.id END) as cases_completed,
        COUNT(DISTINCT CASE WHEN ecp.status = 'proceeded' THEN ecp.id END) as cases_proceeded,
        ROUND(AVG(EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at))))::int as avg_case_time,
        ROUND(SUM(EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at))))::int as total_time_spent
      FROM employee_case_performance ecp
      LEFT JOIN users u ON ecp.employee_id = u.id
      LEFT JOIN tickets t ON ecp.ticket_id = t.id
      WHERE t.created_at >= $1 AND t.created_at <= $2
      GROUP BY ecp.employee_id, u.full_name, u.username
      ORDER BY cases_completed DESC`,
      [fromDate, toDate],
    );

    console.log("[getDailyReport] Employee performance data:", {
      count: employeePerfRes.rows?.length || 0,
      rows: employeePerfRes.rows?.slice(0, 5),
    });

    // Get case workflow details (employee case performance by employee) for the date range
    const caseWorkflowRes = await p.query(
      `SELECT
        ecp.id,
        ecp.employee_id,
        u.full_name,
        u.username,
        ecp.ticket_id,
        t.code as ticket_code,
        t.service,
        extract(epoch from ecp.started_at)*1000 as started_at,
        extract(epoch from ecp.ended_at)*1000 as ended_at,
        ecp.status,
        EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at)) as duration_seconds,
        COALESCE(jt.name_english, ut.name_english, 'Unknown') as job_title_name
      FROM employee_case_performance ecp
      LEFT JOIN users u ON ecp.employee_id = u.id
      LEFT JOIN tickets t ON ecp.ticket_id = t.id
      LEFT JOIN job_title jt ON ecp.job_title_id = jt.id
      LEFT JOIN job_title ut ON u.job_title_id = ut.id
      WHERE t.created_at >= $1 AND t.created_at <= $2
      ORDER BY ecp.started_at ASC`,
      [fromDate, toDate],
    );

    // Get category performance data (aggregate by service) for the date range
    const categoryPerfRes = await p.query(
      `SELECT
        t.service as service_name,
        COUNT(DISTINCT t.id) as total_tickets,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as served,
        COUNT(DISTINCT CASE WHEN t.status = 'skipped' THEN t.id END) as skipped,
        COUNT(DISTINCT CASE WHEN t.status = 'transferred' THEN t.id END) as transferred,
        ROUND(AVG(CASE WHEN t.status = 'done' THEN EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) ELSE NULL END))::int as avg_service_time
      FROM tickets t
      WHERE t.created_at >= $1 AND t.created_at <= $2
      GROUP BY t.service
      ORDER BY total_tickets DESC`,
      [fromDate, toDate],
    );

    const report = {
      reportDate: reportDate,
      generatedAt: new Date().toISOString(),
      summary: {
        totalTicketsCreated: Number(totalTicketsRes.rows[0]?.total || 0),
        served: Number(summary.served || 0),
        skipped: Number(summary.skipped || 0),
        transferred: Number(summary.transferred || 0),
        averageServiceTime: summary.avg_service_time || null,
      },
      allTickets: allTicketsRes.rows.map((r: any) => ({
        ticketId: r.id,
        ticketCode: r.code,
        service: r.service,
        status: r.status,
        windowId: r.window_id,
        windowName: r.window_name,
        createdAt: Math.round(Number(r.created_at)),
        completedAt: r.completed_at ? Math.round(Number(r.completed_at)) : null,
      })),
      skipped: skippedRes.rows.map((r: any) => ({
        ticketId: r.id,
        ticketCode: r.code,
        service: r.service,
        ticketNumber: r.number,
        createdAt: Math.round(Number(r.created_at)),
        skippedAt: Math.round(Number(r.skipped_at)),
        skippedByWindow: r.skipped_by_window,
        skippedByWindowName: r.skipped_by_window_name,
        remark: r.remark,
      })),
      transfers: transfersRes.rows.map((r: any) => ({
        transferId: r.id,
        ticketId: r.ticket_id,
        ticketCode: r.code,
        service: r.service,
        ticketNumber: r.number,
        createdAt: Math.round(Number(r.created_at)),
        transferredAt: Math.round(Number(r.transferred_at)),
        fromWindow: r.from_window,
        fromWindowName: r.from_window_name,
        toWindow: r.to_window,
        toWindowName: r.to_window_name,
        remark: r.remark,
      })),
      windowStats: windowStatsRes.rows.map((r: any) => ({
        windowId: r.id,
        windowName: r.name,
        tellerName: r.teller_name || "N/A",
        served: Number(r.served || 0),
        skipped: Number(r.skipped || 0),
        transfersFrom: Number(r.transfers_from || 0),
        transfersTo: Number(r.transfers_to || 0),
        averageServiceTime: r.avg_service_time || null,
      })),
      employeePerformance: employeePerfRes.rows.map((r: any) => ({
        employeeId: r.employee_id,
        employeeName: r.full_name || r.username || "Unknown",
        totalCasesStarted: Number(r.total_cases_started || 0),
        casesCompleted: Number(r.cases_completed || 0),
        casesProceed: Number(r.cases_proceeded || 0),
        averageCaseTime: r.avg_case_time || null,
        totalTimeSpent: r.total_time_spent || null,
      })),
      caseWorkflow: caseWorkflowRes.rows.map((r: any) => ({
        caseId: r.id,
        employeeId: r.employee_id,
        employeeName: r.full_name || r.username || "Unknown",
        ticketId: r.ticket_id,
        ticketCode: r.ticket_code,
        service: r.service,
        jobTitle: r.job_title_name,
        startedAt: r.started_at ? Math.round(Number(r.started_at)) : null,
        endedAt: r.ended_at ? Math.round(Number(r.ended_at)) : null,
        status: r.status,
        durationSeconds: r.duration_seconds
          ? Math.round(Number(r.duration_seconds))
          : null,
      })),
      categoryPerformance: categoryPerfRes.rows.map((r: any) => ({
        categoryName: r.service_name || "Uncategorized",
        totalTickets: Number(r.total_tickets || 0),
        served: Number(r.served || 0),
        skipped: Number(r.skipped || 0),
        transferred: Number(r.transferred || 0),
        averageServiceTime: r.avg_service_time || null,
      })),
    };

    res.json(report);
  } catch (error) {
    console.error("Failed to generate daily report", error);
    res.status(500).json({ error: "Failed to generate daily report" });
  }
};

export const getOverallAnalytics: RequestHandler = async (_req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "Database not enabled" });
  }

  try {
    const p = getPool();

    console.log("[getOverallAnalytics] Starting query...");

    // Simplified: Just get basic employee stats first
    console.log("[getOverallAnalytics] Fetching employee performance...");
    const employeePerfRes = await p.query(
      `SELECT
        ecp.employee_id,
        u.full_name,
        u.username,
        COUNT(ecp.id) as total_cases_started,
        SUM(CASE WHEN ecp.status = 'completed' THEN 1 ELSE 0 END) as cases_completed,
        SUM(CASE WHEN ecp.status = 'proceeded' THEN 1 ELSE 0 END) as cases_proceeded,
        AVG(EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at))) as avg_case_time_seconds,
        SUM(EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at))) as total_time_spent_seconds
      FROM employee_case_performance ecp
      LEFT JOIN users u ON ecp.employee_id = u.id
      WHERE ecp.started_at IS NOT NULL AND ecp.ended_at IS NOT NULL
      GROUP BY ecp.employee_id, u.full_name, u.username
      ORDER BY cases_completed DESC`,
    );

    console.log(
      "[getOverallAnalytics] Employee performance fetched, rows:",
      employeePerfRes.rows?.length || 0,
    );

    // Get ALL ticket statistics (no daily filter)
    console.log("[getOverallAnalytics] Fetching ticket statistics...");
    const ticketsRes = await p.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as served,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN status = 'transferred' THEN 1 ELSE 0 END) as transferred,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'serving' THEN 1 ELSE 0 END) as serving
      FROM tickets`,
    );

    console.log(
      "[getOverallAnalytics] Tickets fetched, total:",
      ticketsRes.rows[0]?.total || 0,
    );

    // Get category performance (no daily filter)
    console.log("[getOverallAnalytics] Fetching category performance...");
    const categoryPerfRes = await p.query(
      `SELECT
        t.service as service_name,
        COUNT(t.id) as total_tickets,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as served,
        SUM(CASE WHEN t.status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN t.status = 'transferred' THEN 1 ELSE 0 END) as transferred
      FROM tickets t
      GROUP BY t.service
      ORDER BY total_tickets DESC`,
    );

    console.log(
      "[getOverallAnalytics] Categories fetched, count:",
      categoryPerfRes.rows?.length || 0,
    );

    const ticketStats = ticketsRes.rows[0] || {};
    const totalTickets = Number(ticketStats.total || 0);
    const totalServed = Number(ticketStats.served || 0);
    const overallCompletionRate =
      totalTickets > 0 ? Math.round((totalServed / totalTickets) * 100) : 0;

    // Find highest performer
    const highestPerformer =
      employeePerfRes.rows.length > 0 ? employeePerfRes.rows[0] : null;

    // Calculate summary statistics
    const totalEmployees = employeePerfRes.rows.length;
    const totalCasesProcessed = employeePerfRes.rows.reduce(
      (sum: number, r: any) => sum + Number(r.total_cases_started || 0),
      0,
    );

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTickets,
        served: totalServed,
        skipped: Number(ticketStats.skipped || 0),
        transferred: Number(ticketStats.transferred || 0),
        waiting: Number(ticketStats.waiting || 0),
        serving: Number(ticketStats.serving || 0),
        completionRate: overallCompletionRate,
        averageServiceTime: null,
        minServiceTime: null,
        maxServiceTime: null,
      },
      employees: employeePerfRes.rows.map((r: any) => ({
        employeeId: r.employee_id,
        employeeName: r.full_name || r.username || "Unknown",
        totalCasesStarted: Number(r.total_cases_started || 0),
        casesCompleted: Number(r.cases_completed || 0),
        casesProceed: Number(r.cases_proceeded || 0),
        averageCaseTime: r.avg_case_time_seconds
          ? Math.round(Number(r.avg_case_time_seconds))
          : null,
        totalTimeSpent: r.total_time_spent_seconds
          ? Math.round(Number(r.total_time_spent_seconds))
          : null,
      })),
      categories: categoryPerfRes.rows.map((r: any) => ({
        categoryName: r.service_name || "Uncategorized",
        totalTickets: Number(r.total_tickets || 0),
        served: Number(r.served || 0),
        skipped: Number(r.skipped || 0),
        transferred: Number(r.transferred || 0),
        averageServiceTime: null,
        completionRate:
          Number(r.total_tickets || 0) > 0
            ? Math.round(
                (Number(r.served || 0) / Number(r.total_tickets || 0)) * 100,
              )
            : 0,
      })),
      windows: [],
      insights: {
        totalEmployees,
        totalCasesProcessed,
        averageCompletionTimeByEmployee: null,
        highestPerformer:
          highestPerformer && Number(highestPerformer.cases_completed || 0) > 0
            ? {
                employeeName:
                  highestPerformer.full_name ||
                  highestPerformer.username ||
                  "Unknown",
                casesCompleted: Number(highestPerformer.cases_completed || 0),
                averageTime: highestPerformer.avg_case_time_seconds
                  ? Math.round(Number(highestPerformer.avg_case_time_seconds))
                  : null,
              }
            : null,
      },
    };

    console.log(
      "[getOverallAnalytics] Successfully generated analytics report",
    );
    res.json(report);
  } catch (error) {
    console.error(
      "[getOverallAnalytics] Failed to generate overall analytics:",
      error,
    );
    res.status(500).json({
      error: "Failed to generate overall analytics",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Service Categories and Services handlers
export const listServiceCategories: RequestHandler = async (_req, res) => {
  try {
    const categories = await listServiceCategoriesDb();
    res.json({ categories } as ListServiceCategoriesResponse);
  } catch (error) {
    console.error("Failed to list service categories", error);
    res.status(500).json({ error: "Failed to list service categories" });
  }
};

export const getCategoryServices: RequestHandler = async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId) {
      return res.status(400).json({ error: "Category ID is required" });
    }
    const result = await getServicesByCategoryDb(categoryId);
    res.json(result as GetCategoryServicesResponse);
  } catch (error) {
    console.error("Failed to get category services", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to get category services";
    res.status(500).json({ error: message });
  }
};

// Window Services Management
export const getWindowServices: RequestHandler = async (req, res) => {
  try {
    const windowId = Number(req.params.windowId);
    if (isNaN(windowId)) {
      return res.status(400).json({ error: "Invalid window ID" });
    }
    const services = await getWindowServicesDb(windowId);
    res.json({ services });
  } catch (error) {
    console.error("Failed to get window services", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to get window services",
    });
  }
};

export const setWindowServices: RequestHandler = async (req, res) => {
  try {
    const windowId = Number(req.params.windowId);
    if (isNaN(windowId)) {
      return res.status(400).json({ error: "Invalid window ID" });
    }
    const { services } = req.body as { services?: string[] };
    if (!Array.isArray(services)) {
      return res.status(400).json({ error: "Services must be an array" });
    }
    const updated = await setWindowServicesDb(windowId, services);
    res.json({ services: updated });
  } catch (error) {
    console.error("Failed to set window services", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to set window services",
    });
  }
};

// Service Category CRUD
export const createServiceCategory: RequestHandler = async (req, res) => {
  try {
    const { code, name } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Category code is required" });
    }

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Category name is required" });
    }

    const category = await createServiceCategoryDb({
      code: code.trim().toUpperCase(),
      name: name.trim(),
    });

    const auth = (req as any).auth;
    await logAudit({
      action: "service_category.created",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { categoryCode: category.code, categoryName: category.name },
    });

    res.json({
      category,
      message: "Service category created successfully",
    });
  } catch (error: any) {
    console.error("Failed to create service category", error);
    if (error?.code === "23505") {
      return res
        .status(400)
        .json({ error: "Category code or name already exists" });
    }
    res.status(500).json({ error: "Failed to create service category" });
  }
};

export const updateServiceCategory: RequestHandler = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { code, name } = req.body;

    if (!categoryId) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    const category = await updateServiceCategoryDb(categoryId, {
      code: code ? code.trim().toUpperCase() : undefined,
      name: name ? name.trim() : undefined,
    });

    const auth = (req as any).auth;
    await logAudit({
      action: "service_category.updated",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { categoryCode: category.code, categoryName: category.name },
    });

    res.json({
      category,
      message: "Service category updated successfully",
    });
  } catch (error: any) {
    console.error("Failed to update service category", error);
    if (error?.code === "23505") {
      return res
        .status(400)
        .json({ error: "Category code or name already exists" });
    }
    if (error.message === "Category not found") {
      return res.status(404).json({ error: "Category not found" });
    }
    res.status(500).json({ error: "Failed to update service category" });
  }
};

export const deleteServiceCategory: RequestHandler = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({ error: "Category ID is required" });
    }

    await deleteServiceCategoryDb(categoryId);

    const auth = (req as any).auth;
    await logAudit({
      action: "service_category.deleted",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { categoryId },
    });

    res.json({ message: "Service category deleted successfully" });
  } catch (error) {
    console.error("Failed to delete service category", error);
    if (error instanceof Error && error.message === "Category not found") {
      return res.status(404).json({ error: "Category not found" });
    }
    res.status(500).json({ error: "Failed to delete service category" });
  }
};

// Service CRUD
export const createService: RequestHandler = async (req, res) => {
  try {
    const { categoryId, code, name } = req.body;

    if (!categoryId || typeof categoryId !== "string") {
      return res.status(400).json({ error: "Category ID is required" });
    }

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Service code is required" });
    }

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Service name is required" });
    }

    const service = await createServiceDb({
      categoryId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
    });

    const auth = (req as any).auth;
    await logAudit({
      action: "service.created",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { serviceCode: service.code, serviceName: service.name },
    });

    res.json({
      service,
      message: "Service created successfully",
    });
  } catch (error: any) {
    console.error("Failed to create service", error);
    if (error?.code === "23505") {
      return res
        .status(400)
        .json({ error: "Service code already exists in this category" });
    }
    if (error.message.includes("Category not found")) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.status(500).json({ error: "Failed to create service" });
  }
};

export const updateService: RequestHandler = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { code, name } = req.body;

    if (!serviceId) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    const service = await updateServiceDb(serviceId, {
      code: code ? code.trim().toUpperCase() : undefined,
      name: name ? name.trim() : undefined,
    });

    const auth = (req as any).auth;
    await logAudit({
      action: "service.updated",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { serviceCode: service.code, serviceName: service.name },
    });

    res.json({
      service,
      message: "Service updated successfully",
    });
  } catch (error: any) {
    console.error("Failed to update service", error);
    if (error?.code === "23505") {
      return res
        .status(400)
        .json({ error: "Service code already exists in this category" });
    }
    if (error.message === "Service not found") {
      return res.status(404).json({ error: "Service not found" });
    }
    res.status(500).json({ error: "Failed to update service" });
  }
};

export const deleteService: RequestHandler = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!serviceId) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    await deleteServiceDb(serviceId);

    const auth = (req as any).auth;
    await logAudit({
      action: "service.deleted",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { serviceId },
    });

    res.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("Failed to delete service", error);
    if (error instanceof Error && error.message === "Service not found") {
      return res.status(404).json({ error: "Service not found" });
    }
    res.status(500).json({ error: "Failed to delete service" });
  }
};

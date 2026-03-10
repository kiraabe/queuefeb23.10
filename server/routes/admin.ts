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
      `SELECT u.id, u.job_title_id FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       WHERE ur.role = 'employee' LIMIT 3`,
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

    // Create some test hold/transferred tickets for today
    const holdTestCases = [
      { name: "Hold Case 1", hoursAgo: 1 },
      { name: "Hold Case 2", hoursAgo: 3 },
    ];

    for (let i = 0; i < holdTestCases.length; i++) {
      const testCase = holdTestCases[i];
      const createdAt = new Date();
      createdAt.setHours(createdAt.getHours() - testCase.hoursAgo);

      const ticketId = (await import("node:crypto")).randomUUID();
      const number = Math.floor(Math.random() * 9000) + 1000;
      const code = `HLD-${number}`;
      const windowId = (i % 6) + 1;

      const startedAt = new Date(createdAt);
      startedAt.setMinutes(startedAt.getMinutes() + 5);

      await client.query(
        `INSERT INTO tickets (id, code, number, service, status, created_at, started_at, transferred_from_window, transferred_to_user_id, transferred_at, owner_name, service_category, window_id)
         VALUES ($1, $2, $3, 'general', 'transferred', $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          ticketId,
          code,
          number,
          createdAt,
          startedAt,
          windowId,
          employees[0].id,
          new Date(),
          `Hold Customer ${number}`,
          category.id,
          windowId,
        ],
      );

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
    const { maxTicketsPerDay, dailyResetTimeUtc, fifoMode } =
      req.body as UpdateQueueSettingsRequest;

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
         updated_at = now()
       WHERE id = 1
       RETURNING
         max_tickets_per_day,
         daily_reset_time_utc,
         fifo_mode,
         extract(epoch from updated_at)*1000 as updated_at`,
      [maxTicketsPerDay, dailyResetTimeUtc, fifoMode],
    );

    if (!rows.length) {
      return res.status(500).json({ error: "Failed to update queue settings" });
    }

    const row = rows[0];
    const settings: QueueSettings = {
      maxTicketsPerDay: row.max_tickets_per_day,
      dailyResetTimeUtc: row.daily_reset_time_utc,
      fifoMode: row.fifo_mode,
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

export const getEmployeeStats: RequestHandler = async (_req, res) => {
  if (!isDbEnabled) {
    return res.json({
      totalEmployees: 0,
      totalCases: 0,
      topPerformer: "N/A",
      avgDuration: null,
    });
  }

  try {
    const p = getPool();

    // Get total employees (all staff roles)
    let totalEmployees = 0;
    try {
      const employeesRes = await p.query(
        `SELECT COUNT(DISTINCT u.id) as count FROM users u
         INNER JOIN user_roles ur ON u.id = ur.user_id
         WHERE ur.role IN ('employee', 'reception', 'teller')`,
      );
      totalEmployees = Number(employeesRes.rows[0]?.count || 0);
    } catch (err) {
      console.warn("Failed to fetch employee count:", err);
      totalEmployees = 0;
    }

    // Get total cases
    let totalCases = 0;
    try {
      const casesRes = await p.query(
        `SELECT COUNT(DISTINCT id) as count FROM employee_case_performance`,
      );
      totalCases = Number(casesRes.rows[0]?.count || 0);
    } catch (err) {
      console.warn("Failed to fetch cases count:", err);
      totalCases = 0;
    }

    // Get top performer (employee with most cases)
    let topPerformer = "N/A";
    try {
      const topPerformerRes = await p.query(
        `SELECT
          u.full_name,
          COUNT(DISTINCT ecp.id) as case_count
        FROM employee_case_performance ecp
        LEFT JOIN users u ON ecp.employee_id = u.id
        GROUP BY u.id, u.full_name
        ORDER BY case_count DESC
        LIMIT 1`,
      );
      topPerformer = topPerformerRes.rows[0]?.full_name || "N/A";
    } catch (err) {
      console.warn("Failed to fetch top performer:", err);
      topPerformer = "N/A";
    }

    // Get average case duration
    let avgDuration = null;
    try {
      const avgDurationRes = await p.query(
        `SELECT
          ROUND(AVG(EXTRACT(EPOCH FROM (ended_at - started_at))))::int as avg_duration
        FROM employee_case_performance
        WHERE ended_at IS NOT NULL AND started_at IS NOT NULL`,
      );
      avgDuration = avgDurationRes.rows[0]?.avg_duration || null;
    } catch (err) {
      console.warn("Failed to fetch average duration:", err);
      avgDuration = null;
    }

    res.json({
      totalEmployees,
      totalCases,
      topPerformer,
      avgDuration,
    });
  } catch (error) {
    console.error("Failed to fetch employee stats", error);
    // Return default values instead of error
    res.json({
      totalEmployees: 0,
      totalCases: 0,
      topPerformer: "N/A",
      avgDuration: null,
    });
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

    // Get all served tickets (ONLY served tickets for this simplified report)
    const servedTicketsRes = await p.query(
      `SELECT
        t.id,
        t.code,
        t.service,
        t.status,
        COALESCE(t.window_id, t.transferred_from_window, t.transferred_to_window, t.skipped_by_window, (
          SELECT to_window FROM transfer_history
          WHERE ticket_id = t.id
          ORDER BY transferred_at DESC
          LIMIT 1
        )) as window_id,
        COALESCE(
          w.name,
          (SELECT name FROM windows WHERE id = t.transferred_from_window),
          (SELECT name FROM windows WHERE id = t.transferred_to_window),
          (SELECT name FROM windows WHERE id = t.skipped_by_window),
          (SELECT tw.name FROM transfer_history th
           JOIN windows tw ON th.to_window = tw.id
           WHERE th.ticket_id = t.id
           ORDER BY th.transferred_at DESC
           LIMIT 1)
        ) as window_name,
        t.owner_name,
        t.woreda,
        t.selected_services,
        extract(epoch from t.created_at)*1000 as created_at,
        extract(epoch from t.started_at)*1000 as started_at,
        extract(epoch from t.completed_at)*1000 as completed_at
      FROM tickets t
      LEFT JOIN windows w ON t.window_id = w.id
      WHERE t.status = 'done'
        AND t.created_at >= $1
        AND t.created_at <= $2
      ORDER BY t.created_at ASC`,
      [fromDate, toDate],
    );

    // Get window statistics - for ALL windows (served and unserved)
    const windowStatsRes = await p.query(
      `WITH window_served_tickets AS (
        SELECT w.id as window_id, COUNT(DISTINCT t.id) as served_count,
          ROUND(AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))))::int as avg_service_time
        FROM windows w
        LEFT JOIN tickets t ON (
          (t.window_id = w.id
          OR t.transferred_from_window = w.id
          OR EXISTS (SELECT 1 FROM transfer_history th WHERE th.to_window = w.id AND th.ticket_id = t.id))
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
          (SELECT us.username FROM user_sessions us
           WHERE us.window_id = w.id AND us.revoked_at IS NULL
           ORDER BY us.created_at DESC LIMIT 1),
          (SELECT u.username FROM users u WHERE u.window_id = w.id LIMIT 1),
          'Unassigned'
        ) as teller_name,
        COALESCE(wst.served_count, 0)::int as served,
        COALESCE(wst.avg_service_time, NULL)::int as avg_service_time
      FROM windows w
      LEFT JOIN window_served_tickets wst ON wst.window_id = w.id
      ORDER BY w.id`,
      [fromDate, toDate],
    );

    // Get summary statistics - only served tickets
    const summaryRes = await p.query(
      `SELECT
        COUNT(CASE WHEN status = 'done' THEN 1 END)::int as served,
        COUNT(CASE WHEN status = 'skipped' THEN 1 END)::int as skipped,
        COUNT(CASE WHEN status = 'transferred' THEN 1 END)::int as transferred,
        COUNT(*)::int as total,
        ROUND(AVG(CASE WHEN started_at IS NOT NULL AND completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_at - started_at)) ELSE NULL END))::int as avg_service_time
      FROM tickets
      WHERE created_at >= $1 AND created_at <= $2`,
      [fromDate, toDate],
    );

    const summary = summaryRes.rows[0] || {};

    // Debug: Log selected_services from tickets
    console.log("[getDailyReport] Served tickets with selected_services:", servedTicketsRes.rows?.map((r: any) => ({
      code: r.code,
      selected_services: r.selected_services
    })));

    console.log("[getDailyReport] Summary statistics:", {
      dateRange: { fromDate, toDate },
      summary,
      windowStatsCount: windowStatsRes.rows?.length || 0,
      servedTicketsCount: servedTicketsRes.rows?.length || 0,
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

    // Load service categories and their standard times, and create service code to name mapping
    const serviceStandardTimes: Record<string, number> = {};
    const serviceCategoryNames: Record<string, string> = {}; // Map category code to name
    const serviceIdToName: Record<string, string> = {}; // Map service ID (UUID) to service name
    try {
      const categoriesRes = await p.query(
        `SELECT id, code, name FROM service_categories ORDER BY name ASC`
      );

      for (const category of categoriesRes.rows) {
        serviceCategoryNames[category.code] = category.name;

        const servicesRes = await p.query(
          `SELECT id, name, standard_time_minutes FROM services WHERE category_id = $1 ORDER BY name ASC`,
          [category.id]
        );

        for (const service of servicesRes.rows) {
          // Map service ID to name for selected_services resolution
          serviceIdToName[service.id] = service.name;

          if (service.name && service.standard_time_minutes) {
            serviceStandardTimes[service.name] = Number(service.standard_time_minutes);
          }
        }
      }

      console.log("[getDailyReport] Loaded service standard times:", serviceStandardTimes);
      console.log("[getDailyReport] Loaded service category names:", serviceCategoryNames);
      console.log("[getDailyReport] Loaded service ID to name mapping:", serviceIdToName);

      // Debug: Show the actual service IDs we loaded
      const loadedServiceIds = Object.keys(serviceIdToName);
      console.log("[getDailyReport] Loaded service IDs:", loadedServiceIds);
    } catch (err) {
      console.debug("[getDailyReport] Error loading service standard times:", err);
    }

    const report = {
      reportDate: reportDate,
      generatedAt: new Date().toISOString(),
      summary: {
        totalTicketsCreated: Number(summary.total || 0),
        served: Number(summary.served || 0),
        skipped: Number(summary.skipped || 0),
        transferred: Number(summary.transferred || 0),
        averageServiceTime: summary.avg_service_time || null,
      },
      windowStats: windowStatsRes.rows.map((r: any) => {
        const avgServiceTime = r.avg_service_time || null;
        const standardTime = serviceStandardTimes[r.name] || null;
        const servedCount = Number(r.served || 0);

        let performanceLevel: "on_time" | "slightly_over" | "significantly_over" | null = null;
        if (avgServiceTime && standardTime) {
          const standardSeconds = standardTime * 60;
          // Formula: 100 - ((Actual Duration - Standard Duration) ÷ Standard Duration) × 100
          const percentageOfStandard = Math.round(100 - ((avgServiceTime - standardSeconds) / standardSeconds) * 100);
          if (percentageOfStandard < 80) {
            performanceLevel = "significantly_over";
          } else if (percentageOfStandard < 100) {
            performanceLevel = "slightly_over";
          } else {
            performanceLevel = "on_time";
          }
        }

        return {
          windowId: r.id,
          windowName: r.name,
          tellerName: r.teller_name || "Unassigned",
          servedTickets: servedCount,
          averageServiceTime: avgServiceTime,
          performanceLevel: servedCount > 0 && standardTime ? performanceLevel : null,
        };
      }),
      detailedTickets: servedTicketsRes.rows.map((r: any) => {
        const duration = r.completed_at && r.started_at
          ? Math.round((r.completed_at - r.started_at) / 1000)
          : null;

        // Map selected service IDs (UUIDs) to their names and collect standard times
        let selectedServiceNames: string[] | undefined = undefined;
        let totalStandardTime = 0;
        let hasStandardTime = false;

        if (r.selected_services && Array.isArray(r.selected_services)) {
          selectedServiceNames = r.selected_services.map((serviceId: string) => {
            const mappedName = serviceIdToName[serviceId];

            // Find standard time for this specific service ID
            // Note: serviceStandardTimes is currently indexed by name, which is fragile.
            // But we can also look up by name from serviceIdToName.
            if (mappedName && serviceStandardTimes[mappedName]) {
              totalStandardTime += serviceStandardTimes[mappedName];
              hasStandardTime = true;
            }

            return mappedName || serviceId;
          });
        }

        // Fallback to category standard time if no specific services selected
        const categoryStandardTime = serviceStandardTimes[r.service] || null;
        const standardTime = hasStandardTime ? totalStandardTime : categoryStandardTime;

        let performanceLevel = null;
        if (duration && standardTime) {
          const standardSeconds = standardTime * 60;
          // Formula: 100 - ((Actual Duration - Standard Duration) ÷ Standard Duration) × 100
          const percentageOfStandard = Math.round(100 - ((duration - standardSeconds) / standardSeconds) * 100);
          if (percentageOfStandard < 80) {
            performanceLevel = "significantly_over";
          } else if (percentageOfStandard < 100) {
            performanceLevel = "slightly_over";
          } else {
            performanceLevel = "on_time";
          }
        }

        // Generate window name: prioritize window_name, then use window_id with "Window " prefix, otherwise "N/A"
        let windowName = "N/A";
        const effectiveWindowId = r.window_id;

        if (r.window_name && r.window_name !== "null" && r.window_name !== "N/A") {
          windowName = r.window_name;
        } else if (effectiveWindowId !== null && effectiveWindowId !== undefined && effectiveWindowId !== 0) {
          windowName = `Window ${effectiveWindowId}`;
        }

        return {
          ticketId: r.id,
          ticketCode: r.code,
          service: serviceCategoryNames[r.service] || r.service,
          windowId: r.window_id !== null && r.window_id !== undefined ? r.window_id : null,
          windowName: windowName,
          ownerName: r.owner_name || undefined,
          woreda: r.woreda || undefined,
          selectedServices: selectedServiceNames,
          createdAt: Math.round(Number(r.created_at)),
          startedAt: Math.round(Number(r.started_at)),
          completedAt: Math.round(Number(r.completed_at)),
          serviceDurationSeconds: duration,
          standardTimeMinutes: standardTime,
          performanceLevel: performanceLevel,
        };
      }),
      serviceStandardTimes: serviceStandardTimes,
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
        SUM(CASE WHEN t.status = 'transferred' THEN 1 ELSE 0 END) as transferred,
        ROUND(AVG(CASE WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) ELSE NULL END))::int as avg_service_time
      FROM tickets t
      GROUP BY t.service
      ORDER BY total_tickets DESC`,
    );

    console.log(
      "[getOverallAnalytics] Categories fetched, count:",
      categoryPerfRes.rows?.length || 0,
    );

    // Get overall average service time
    const overallAvgTimeRes = await p.query(
      `SELECT
        ROUND(AVG(CASE WHEN started_at IS NOT NULL AND completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_at - started_at)) ELSE NULL END))::int as avg_service_time
      FROM tickets`,
    );

    const ticketStats = ticketsRes.rows[0] || {};
    const totalTickets = Number(ticketStats.total || 0);
    const totalServed = Number(ticketStats.served || 0);
    const overallCompletionRate =
      totalTickets > 0 ? Math.round((totalServed / totalTickets) * 100) : 0;
    const overallAvgServiceTime =
      overallAvgTimeRes.rows[0]?.avg_service_time || null;

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
        averageServiceTime: overallAvgServiceTime,
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
        averageServiceTime: r.avg_service_time || null,
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
    const { categoryId, code, name, standardTimeMinutes } = req.body;

    if (!categoryId || typeof categoryId !== "string") {
      return res.status(400).json({ error: "Category ID is required" });
    }

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Service code is required" });
    }

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Service name is required" });
    }

    if (
      standardTimeMinutes !== undefined &&
      (!Number.isInteger(standardTimeMinutes) || standardTimeMinutes < 0)
    ) {
      return res
        .status(400)
        .json({
          error: "Standard time must be a non-negative integer (minutes)",
        });
    }

    const service = await createServiceDb({
      categoryId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      standardTimeMinutes: standardTimeMinutes || undefined,
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
    const { code, name, standardTimeMinutes } = req.body;

    if (!serviceId) {
      return res.status(400).json({ error: "Service ID is required" });
    }

    if (
      standardTimeMinutes !== undefined &&
      standardTimeMinutes !== null &&
      (!Number.isInteger(standardTimeMinutes) || standardTimeMinutes < 0)
    ) {
      return res
        .status(400)
        .json({
          error: "Standard time must be a non-negative integer (minutes)",
        });
    }

    const service = await updateServiceDb(serviceId, {
      code: code ? code.trim().toUpperCase() : undefined,
      name: name ? name.trim() : undefined,
      standardTimeMinutes: standardTimeMinutes || undefined,
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

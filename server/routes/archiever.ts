import { RequestHandler } from "express";
import { getPool, logAudit, compileAndStoreProgressFlow } from "../store/db";

// Get all tickets in global queue waiting for document retrieval
export const getGlobalQueue: RequestHandler = async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, code, service, number, owner_name, woreda, created_at,
              status, documents_fetched, archiver_id, archiver_started_at,
              service_category, "Land Holding Rights Certificate (ካርታ) ser no.",
              "Land Holding Rights Certificate (ካርታ) No."
       FROM tickets
       WHERE status = 'waiting_archive'
       AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE AT TIME ZONE 'UTC'
       ORDER BY created_at ASC`,
    );

    const tickets = result.rows.map((row, index) => ({
      id: row.id,
      code: row.code,
      service: row.service,
      number: row.number,
      ownerName: row.owner_name,
      woreda: row.woreda,
      createdAt: new Date(row.created_at).getTime(),
      status: row.status,
      documentsFetched: row.documents_fetched,
      serviceCategory: row.service_category,
      archiverStartedAt: row.archiver_started_at
        ? new Date(row.archiver_started_at).getTime()
        : null,
      isLocked: !!row.archiver_id,
      queuePosition: index + 1,
      waitDuration: Math.floor(
        (Date.now() - new Date(row.created_at).getTime()) / 1000 / 60,
      ), // minutes
      landCertificateKarta:
        row["Land Holding Rights Certificate (ካርታ) ser no."] ?? undefined,
      landCertificateDigital:
        row["Land Holding Rights Certificate (ዲጂታል ካርታ) No."] ?? undefined,
    }));

    res.json({ tickets });
  } catch (error) {
    console.error("Error fetching global queue:", error);
    res.status(500).json({ error: "Failed to fetch global queue" });
  }
};

// Get all tickets waiting for documents to be fetched (legacy endpoint)
export const getWaitingDocumentsDb: RequestHandler = async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, code, service, number, owner_name, woreda, created_at,
              status, documents_fetched, documents_fetched_at
       FROM tickets
       WHERE status IN ('waiting', 'serving')
       AND documents_fetched = false
       ORDER BY created_at ASC`,
    );

    const tickets = result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      service: row.service,
      number: row.number,
      ownerName: row.owner_name,
      woreda: row.woreda,
      createdAt: new Date(row.created_at).getTime(),
      status: row.status,
      documentsFetched: row.documents_fetched,
      documentsFetchedAt: row.documents_fetched_at
        ? new Date(row.documents_fetched_at).getTime()
        : null,
    }));

    res.json({ tickets });
  } catch (error) {
    console.error("Error fetching waiting documents:", error);
    res.status(500).json({ error: "Failed to fetch waiting documents" });
  }
};

// Mark documents as fetched for a ticket
export const markDocumentsFetched: RequestHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = (req as any).auth?.id;
    const username = (req as any).auth?.username;

    if (!ticketId) {
      return res.status(400).json({ error: "Ticket ID is required" });
    }

    const pool = getPool();

    // Update ticket to mark documents as fetched
    const result = await pool.query(
      `UPDATE tickets 
       SET documents_fetched = true, documents_fetched_at = now()
       WHERE id = $1
       RETURNING id, code, documents_fetched, documents_fetched_at`,
      [ticketId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = result.rows[0];

    // Log audit
    await logAudit({
      action: "documents_fetched",
      userId,
      username,
      details: { ticketId, ticketCode: ticket.code },
    });

    res.json({
      success: true,
      ticket: {
        id: ticket.id,
        code: ticket.code,
        documentsFetched: ticket.documents_fetched,
        documentsFetchedAt: ticket.documents_fetched_at
          ? new Date(ticket.documents_fetched_at).getTime()
          : null,
      },
    });
  } catch (error) {
    console.error("Error marking documents as fetched:", error);
    res.status(500).json({ error: "Failed to mark documents as fetched" });
  }
};

// Start a ticket (claim it for this archiver)
export const startTicket: RequestHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = (req as any).auth?.id;
    const username = (req as any).auth?.username;

    if (!ticketId || !userId) {
      return res
        .status(400)
        .json({ error: "Ticket ID and user ID are required" });
    }

    const pool = getPool();

    // Check if ticket is already locked by another archiver
    const checkResult = await pool.query(
      `SELECT archiver_id FROM tickets WHERE id = $1`,
      [ticketId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (
      checkResult.rows[0].archiver_id &&
      checkResult.rows[0].archiver_id !== userId
    ) {
      return res
        .status(409)
        .json({ error: "Ticket is already claimed by another archiver" });
    }

    // Lock ticket for this archiver
    const result = await pool.query(
      `UPDATE tickets
       SET archiver_id = $1, archiver_started_at = now()
       WHERE id = $2 AND status = 'waiting_archive' AND documents_fetched = false
       RETURNING id, code, service, number, owner_name, service_category,
                 required_documents, document_checklist, internal_notes`,
      [userId, ticketId],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: "Could not claim ticket - it may already be retrieved",
      });
    }

    const ticket = result.rows[0];

    // Create archiver progress record
    try {
      await pool.query(
        `INSERT INTO employee_case_performance (ticket_id, employee_id, step_type, started_at, status)
         VALUES ($1, $2, $3, now(), $4)
         ON CONFLICT DO NOTHING`,
        [ticketId, userId, "archiver", "in_progress"],
      );
    } catch (err) {
      // If progress record creation fails, continue - it's not critical
      console.error("Failed to create archiver progress record:", err);
    }

    // Log audit
    await logAudit({
      action: "ticket_started",
      userId,
      username,
      details: { ticketId, ticketCode: ticket.code },
    });

    res.json({
      success: true,
      ticket: {
        id: ticket.id,
        code: ticket.code,
        service: ticket.service,
        number: ticket.number,
        ownerName: ticket.owner_name,
        serviceCategory: ticket.service_category,
        requiredDocuments: ticket.required_documents || [],
        documentChecklist: ticket.document_checklist || {},
        internalNotes: ticket.internal_notes || "",
      },
    });
  } catch (error) {
    console.error("Error starting ticket:", error);
    res.status(500).json({ error: "Failed to start ticket" });
  }
};

// Get details of a ticket being worked on
export const getTicketDetails: RequestHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = (req as any).auth?.id;

    if (!ticketId) {
      return res.status(400).json({ error: "Ticket ID is required" });
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, code, service, number, owner_name, woreda, service_category,
              created_at, archiver_id, archiver_started_at,
              required_documents, document_checklist, internal_notes, documents_fetched
       FROM tickets
       WHERE id = $1`,
      [ticketId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = result.rows[0];

    // Check if current user has access
    if (ticket.archiver_id && ticket.archiver_id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have access to this ticket" });
    }

    res.json({
      ticket: {
        id: ticket.id,
        code: ticket.code,
        service: ticket.service,
        number: ticket.number,
        ownerName: ticket.owner_name,
        woreda: ticket.woreda,
        serviceCategory: ticket.service_category,
        createdAt: new Date(ticket.created_at).getTime(),
        archiverStartedAt: ticket.archiver_started_at
          ? new Date(ticket.archiver_started_at).getTime()
          : null,
        requiredDocuments: ticket.required_documents || [],
        documentChecklist: ticket.document_checklist || {},
        internalNotes: ticket.internal_notes || "",
        documentsFetched: ticket.documents_fetched,
      },
    });
  } catch (error) {
    console.error("Error getting ticket details:", error);
    res.status(500).json({ error: "Failed to get ticket details" });
  }
};

// Add or update internal notes
export const addInternalNotes: RequestHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { notes } = req.body;
    const userId = (req as any).auth?.id;
    const username = (req as any).auth?.username;

    if (!ticketId || !notes) {
      return res
        .status(400)
        .json({ error: "Ticket ID and notes are required" });
    }

    const pool = getPool();

    // Check if user has access to this ticket
    const checkResult = await pool.query(
      `SELECT archiver_id FROM tickets WHERE id = $1`,
      [ticketId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (checkResult.rows[0].archiver_id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have access to this ticket" });
    }

    const result = await pool.query(
      `UPDATE tickets
       SET internal_notes = $1
       WHERE id = $2
       RETURNING id, code, internal_notes`,
      [notes, ticketId],
    );

    // Log audit
    await logAudit({
      action: "internal_notes_added",
      userId,
      username,
      details: { ticketId, notesLength: notes.length },
    });

    res.json({
      success: true,
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("Error adding internal notes:", error);
    res.status(500).json({ error: "Failed to add internal notes" });
  }
};

// Update document checklist item
export const updateDocumentChecklist: RequestHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { documentName, status } = req.body;
    const userId = (req as any).auth?.id;
    const username = (req as any).auth?.username;

    if (!ticketId || !documentName || !status) {
      return res
        .status(400)
        .json({ error: "Ticket ID, document name, and status are required" });
    }

    const pool = getPool();

    // Check if user has access to this ticket
    const checkResult = await pool.query(
      `SELECT archiver_id, document_checklist FROM tickets WHERE id = $1`,
      [ticketId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (checkResult.rows[0].archiver_id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have access to this ticket" });
    }

    const currentChecklist = checkResult.rows[0].document_checklist || {};
    const updatedChecklist = {
      ...currentChecklist,
      [documentName]: { status, verifiedAt: new Date().toISOString() },
    };

    const result = await pool.query(
      `UPDATE tickets
       SET document_checklist = $1
       WHERE id = $2
       RETURNING id, code, document_checklist`,
      [JSON.stringify(updatedChecklist), ticketId],
    );

    // Log audit
    await logAudit({
      action: "document_verified",
      userId,
      username,
      details: { ticketId, documentName, status },
    });

    res.json({
      success: true,
      documentChecklist: updatedChecklist,
    });
  } catch (error) {
    console.error("Error updating document checklist:", error);
    res.status(500).json({ error: "Failed to update document checklist" });
  }
};

// Mark ticket as retrieved (move to service-specific queue)
export const markTicketRetrieved: RequestHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = (req as any).auth?.id;
    const username = (req as any).auth?.username;

    if (!ticketId || !userId) {
      return res
        .status(400)
        .json({ error: "Ticket ID and user ID are required" });
    }

    const pool = getPool();

    // Get ticket details
    const ticketResult = await pool.query(
      `SELECT id, code, service_category, document_checklist, required_documents, archiver_id
       FROM tickets
       WHERE id = $1`,
      [ticketId],
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = ticketResult.rows[0];

    // Check if user is the one who claimed it
    if (ticket.archiver_id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have access to this ticket" });
    }

    // Check if all required documents are verified
    const checklist = ticket.document_checklist || {};
    const requiredDocs = ticket.required_documents || [];

    let allDocumentsVerified = true;
    for (const doc of requiredDocs) {
      if (!checklist[doc] || checklist[doc].status !== "verified") {
        allDocumentsVerified = false;
        break;
      }
    }

    if (!allDocumentsVerified) {
      // Check if override is requested
      const { overrideValidation } = req.body;
      if (!overrideValidation) {
        return res.status(400).json({
          error: "Not all required documents have been verified",
          missingDocuments: requiredDocs.filter(
            (doc) => !checklist[doc] || checklist[doc].status !== "verified",
          ),
        });
      }
    }

    // Update ticket: mark as retrieved and clear archiver lock
    // Change status from waiting_archive to waiting so it appears in service-specific queue for tellers
    // NOTE: We keep archiver_started_at to calculate processing time in history
    const result = await pool.query(
      `UPDATE tickets
       SET status = 'waiting',
           documents_fetched = true,
           documents_fetched_at = now(),
           archived_by_user_id = $1,
           archiver_id = NULL
       WHERE id = $2
       RETURNING id, code, service_category, status, documents_fetched, documents_fetched_at`,
      [userId, ticketId],
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ error: "Failed to update ticket status" });
    }

    // Update archiver progress record to mark as retrieved
    try {
      await pool.query(
        `UPDATE employee_case_performance SET ended_at=now(), status='retrieved' WHERE ticket_id=$1 AND step_type='archiver' AND employee_id=$2 AND status='in_progress'`,
        [ticketId, userId],
      );
    } catch (err) {
      // If progress record update fails, continue - it's not critical
      console.error("Failed to update archiver progress record:", err);
    }

    // Check if there are any pending employee steps for this ticket
    try {
      const pendingEmployeeStepsRes = await pool.query(
        `SELECT COUNT(*) as incomplete FROM employee_case_performance
         WHERE ticket_id = $1 AND step_type = 'employee' AND status != 'completed'`,
        [ticketId],
      );
      const incompleteEmployeeSteps = Number(
        pendingEmployeeStepsRes.rows[0]?.incomplete || 0,
      );

      // If there are no pending employee steps, compile and store the progress flow
      if (incompleteEmployeeSteps === 0) {
        try {
          console.log(
            `📊 Archiver completed ticket ${ticketId}. Compiling progress flow (no pending employee steps)...`,
          );
          await compileAndStoreProgressFlow(ticketId);
          console.log(
            `✅ Progress flow compiled and stored for ticket ${ticketId}`,
          );
        } catch (compileErr) {
          console.error(
            `❌ Error storing progress flow for ticket ${ticketId}:`,
            compileErr,
          );
          // Don't fail the retrieval if progress flow storage fails
        }
      }
    } catch (err) {
      // If checking pending steps fails, continue - it's not critical
      console.error("Failed to check pending employee steps:", err);
    }

    // Log audit
    await logAudit({
      action: "ticket_retrieved",
      userId,
      username,
      details: { ticketId, ticketCode: ticket.code },
    });

    res.json({
      success: true,
      ticket: {
        id: result.rows[0].id,
        code: result.rows[0].code,
        serviceCategory: result.rows[0].service_category,
        documentsFetched: result.rows[0].documents_fetched,
        documentsFetchedAt: result.rows[0].documents_fetched_at
          ? new Date(result.rows[0].documents_fetched_at).getTime()
          : null,
      },
    });
  } catch (error) {
    console.error("Error marking ticket as retrieved:", error);
    res.status(500).json({ error: "Failed to mark ticket as retrieved" });
  }
};

// Release ticket lock (return to global queue)
export const releaseTicket: RequestHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = (req as any).auth?.id;
    const username = (req as any).auth?.username;

    if (!ticketId || !userId) {
      return res
        .status(400)
        .json({ error: "Ticket ID and user ID are required" });
    }

    const pool = getPool();

    // Check if user is the one who claimed it
    const checkResult = await pool.query(
      `SELECT archiver_id, code FROM tickets WHERE id = $1`,
      [ticketId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (checkResult.rows[0].archiver_id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have access to this ticket" });
    }

    // Release the lock
    const result = await pool.query(
      `UPDATE tickets
       SET archiver_id = NULL, archiver_started_at = NULL
       WHERE id = $1
       RETURNING id, code`,
      [ticketId],
    );

    // Log audit
    await logAudit({
      action: "ticket_released",
      userId,
      username,
      details: { ticketId, ticketCode: checkResult.rows[0].code },
    });

    res.json({
      success: true,
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("Error releasing ticket:", error);
    res.status(500).json({ error: "Failed to release ticket" });
  }
};

// Get completed tickets (archived history)
export const getArchivedHistory: RequestHandler = async (req, res) => {
  try {
    const pool = getPool();
    const userId = (req as any).auth?.id;
    const userRole = (req as any).auth?.role;

    // Check if user is admin
    let query = `
      SELECT id, code, service, number, owner_name, service_category,
             created_at, archiver_started_at, documents_fetched_at, manually_archived_at
      FROM tickets
      WHERE documents_fetched = true
    `;

    // Filter by current user only if not admin
    if (userId && userRole !== "admin") {
      query += ` AND archived_by_user_id = $1`;
    }

    query += ` ORDER BY documents_fetched_at DESC LIMIT 100`;

    const result = await pool.query(
      query,
      userId && userRole !== "admin" ? [userId] : [],
    );

    const tickets = result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      service: row.service,
      number: row.number,
      ownerName: row.owner_name,
      serviceCategory: row.service_category,
      createdAt: new Date(row.created_at).getTime(),
      archiverStartedAt: row.archiver_started_at
        ? new Date(row.archiver_started_at).getTime()
        : null,
      retrievedAt: row.documents_fetched_at
        ? new Date(row.documents_fetched_at).getTime()
        : null,
      manuallyArchivedAt: row.manually_archived_at
        ? new Date(row.manually_archived_at).getTime()
        : null,
      processingTime:
        row.archiver_started_at && row.documents_fetched_at
          ? (new Date(row.documents_fetched_at).getTime() -
              new Date(row.archiver_started_at).getTime()) /
            1000 /
            60 // minutes with decimal precision
          : null,
    }));

    res.json({ tickets });
  } catch (error) {
    console.error("Error fetching archived history:", error);
    res.status(500).json({ error: "Failed to fetch archived history" });
  }
};

// Get documents status for a specific ticket
export const getDocumentStatus: RequestHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      return res.status(400).json({ error: "Ticket ID is required" });
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, code, documents_fetched, documents_fetched_at
       FROM tickets
       WHERE id = $1`,
      [ticketId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = result.rows[0];
    res.json({
      documentsFetched: ticket.documents_fetched,
      documentsFetchedAt: ticket.documents_fetched_at
        ? new Date(ticket.documents_fetched_at).getTime()
        : null,
    });
  } catch (error) {
    console.error("Error getting document status:", error);
    res.status(500).json({ error: "Failed to get document status" });
  }
};

// Manually archive a retrieved ticket (Back To Archive action)
export const manuallyArchiveTicket: RequestHandler = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const auth = req.auth;

    if (!auth) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!ticketId) {
      return res.status(400).json({ error: "Ticket ID is required" });
    }

    const pool = getPool();

    // Get the ticket
    const result = await pool.query(
      `SELECT id, code, status, documents_fetched_at
       FROM tickets
       WHERE id = $1`,
      [ticketId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = result.rows[0];

    // Verify ticket has been retrieved
    if (!ticket.documents_fetched_at) {
      return res.status(400).json({
        error: "Ticket has not been retrieved yet",
      });
    }

    // Update manually_archived_at timestamp
    const updateResult = await pool.query(
      `UPDATE tickets
       SET manually_archived_at = now()
       WHERE id = $1
       RETURNING id, code, manually_archived_at`,
      [ticketId],
    );

    if (updateResult.rows.length === 0) {
      return res.status(500).json({ error: "Failed to archive ticket" });
    }

    // Log audit
    await logAudit({
      action: "ticket_manually_archived",
      userId: auth.id,
      username: auth.username,
      details: { ticketId, ticketCode: ticket.code },
    });

    const archivedTicket = updateResult.rows[0];
    res.json({
      success: true,
      ticket: {
        id: archivedTicket.id,
        code: archivedTicket.code,
        manuallyArchivedAt: archivedTicket.manually_archived_at
          ? new Date(archivedTicket.manually_archived_at).getTime()
          : null,
      },
    });
  } catch (error) {
    console.error("Error manually archiving ticket:", error);
    res.status(500).json({ error: "Failed to manually archive ticket" });
  }
};

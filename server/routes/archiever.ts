import { RequestHandler } from "express";
import { getPool, logAudit } from "../store/db";

// Get all tickets waiting for documents to be fetched
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
    const userId = (req as any).user?.id;
    const username = (req as any).user?.username;

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
      [ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = result.rows[0];

    // Log audit
    await logAudit(pool, {
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
      [ticketId]
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

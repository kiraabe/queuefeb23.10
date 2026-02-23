import WebSocket from "ws";
import type { SessionSummary } from "../../shared/api";
import { listSessions } from "../store/sessions";

interface SessionUpdateMessage {
  type: "init" | "update";
  sessions: SessionSummary[];
  timestamp: number;
}

// Store all active WebSocket connections for admin session monitoring
const adminSessionClients = new Set<WebSocket>();

/**
 * Handle a new WebSocket connection for admin session monitoring
 */
export function handleAdminSessionConnection(ws: WebSocket) {
  console.log("[SessionWS] New admin session monitoring connection");
  adminSessionClients.add(ws);

  // Send initial sessions data
  sendSessionsToClient(ws);

  ws.on("close", () => {
    console.log("[SessionWS] Admin session monitoring connection closed");
    adminSessionClients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("[SessionWS] WebSocket error:", error);
    adminSessionClients.delete(ws);
  });

  ws.on("message", (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }
    } catch (error) {
      console.error("[SessionWS] Error parsing message:", error);
    }
  });
}

/**
 * Send current sessions to a specific client
 */
async function sendSessionsToClient(ws: WebSocket) {
  try {
    const sessions = await listSessions();
    const message: SessionUpdateMessage = {
      type: "init",
      sessions,
      timestamp: Date.now(),
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  } catch (error) {
    console.error("[SessionWS] Error fetching sessions for client:", error);
  }
}

/**
 * Broadcast session updates to all connected admin clients
 */
export async function broadcastSessionUpdate() {
  if (adminSessionClients.size === 0) return;

  try {
    const sessions = await listSessions();
    const message: SessionUpdateMessage = {
      type: "update",
      sessions,
      timestamp: Date.now(),
    };

    const messageStr = JSON.stringify(message);
    const deadClients: WebSocket[] = [];

    adminSessionClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      } else {
        deadClients.push(client);
      }
    });

    // Clean up dead connections
    deadClients.forEach((client) => adminSessionClients.delete(client));
  } catch (error) {
    console.error("[SessionWS] Error broadcasting session update:", error);
  }
}

/**
 * Get the number of connected admin clients
 */
export function getConnectedAdminClients(): number {
  return adminSessionClients.size;
}

/**
 * Close all WebSocket connections (for graceful shutdown)
 */
export function closeAllConnections() {
  adminSessionClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });
  adminSessionClients.clear();
}

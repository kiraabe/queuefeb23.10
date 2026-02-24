import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { WebSocketServer } from "ws";
import type { Server as HTTPServer } from "node:http";
import { getPool } from "./store/db";
import { handleAdminSessionConnection } from "./services/session-websocket";
import { handleDemo } from "./routes/demo";
import {
  clearDemo,
  seedTestData,
  getQueueSettings,
  updateQueueSettings,
  getDailyReport,
  getOverallAnalytics,
  getEmployeeStats,
  listServiceCategories,
  getCategoryServices,
  getWindowServices,
  setWindowServices,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  createService,
  updateService,
  deleteService,
} from "./routes/admin";
import { setupAdmin } from "./routes/admin-setup";
import {
  callNext,
  complete,
  createTicket,
  displayData,
  listWindows,
  recall,
  // seedDemo, // removed
  skip,
  sseHandler,
  transfer,
  getTicketStatus,
} from "./routes/queue";
import {
  listSessionsHandler,
  debugSessionsHandler,
  revokeSessionHandler,
  revokeAllSessionsHandler,
  getSessionCountHandler,
  sessionPing,
  login,
  logout,
  me,
  heartbeat,
  tabOpened,
  tabClosed,
  requireRole,
  requireTellerForWindowParam,
  requireAuthentication,
  switchRole,
} from "./routes/auth";
import { cleanupAllStaleSessions } from "./store/sessions";
import { autoCancelExpiredHolds, DB_CONFIG } from "./store/db";
import { dbRateLimitMiddleware, strictDbRateLimitMiddleware, extractUserIdMiddleware } from "./middleware/db-rate-limit";
import { getRateLimitStatus, resetUserRateLimit, clearAllRateLimits } from "./services/query-rate-limiter";
import { tellerStats, tellerTickets } from "./routes/teller";
import {
  employeeReceivedTickets,
  employeeStats,
  employeeHistory,
  startCase,
  completeCase,
  proceedCase,
  handleStartCase,
  employeePerformanceMetrics,
  caseWorkflow,
  listCaseWorkflows,
  getStoredProgressFlow,
  requireFieldVisit,
  startFieldWork,
  completeFieldWork,
  listFieldVisitCases,
  getFieldVisitCase,
  readyForService,
  holdCase,
  resumeCase,
  getCaseHolds,
} from "./routes/employee";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listWindows as listWindowsForManagement,
  createWindow,
  updateWindow,
  deleteWindow,
  assignTellerToWindow,
  resetWindowPassword,
  resetUserPassword,
  listJobTitlesHandler,
} from "./routes/management";
import {
  getWaitingDocumentsDb,
  markDocumentsFetched,
  getDocumentStatus,
  getGlobalQueue,
  startTicket,
  getTicketDetails,
  addInternalNotes,
  updateDocumentChecklist,
  markTicketRetrieved,
  releaseTicket,
  getArchivedHistory,
  manuallyArchiveTicket,
} from "./routes/archiever";

export function createServer() {
  const app = express();

  // Respect proxy headers for HTTPS detection in production
  app.set("trust proxy", true);

  // Middleware
  // Configure CORS: allow same-origin and any configured ALLOWED_ORIGINS. In development allow all origins for convenience.
  const allowedEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Check if we should allow any origin (dev mode or explicit override)
  const allowAnyOrigin =
    process.env.ALLOW_ANY_ORIGIN === "true" || !process.env.ALLOWED_ORIGINS;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // same-origin or non-browser clients
        if (allowAnyOrigin) return callback(null, true); // Allow all when no ALLOWED_ORIGINS is set
        try {
          const u = new URL(origin);
          if (
            allowedEnv.includes(u.origin) ||
            allowedEnv.includes(u.host) ||
            allowedEnv.includes(u.hostname)
          )
            return callback(null, true);
        } catch {}
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Requested-With", "X-CSRF-Token", "Sec-CH-UA-Platform-Version"],
    }),
  );

  // Enforce HTTPS in production
  app.use((req, res, next) => {
    const isProd =
      process.env.NODE_ENV === "production" ||
      process.env.FORCE_HTTPS === "true";
    if (isProd) {
      const proto = (req.headers["x-forwarded-proto"] as string) || "";
      if (proto && !proto.split(",")[0].includes("https")) {
        const host = req.headers.host || "";
        const url = `https://${host}${req.originalUrl}`;
        return res.redirect(301, url);
      }
    }
    // Disable strict origin checks if ALLOWED_ORIGINS is not explicitly configured
    // This allows the app to work on any origin in production without additional config
    next();
  });

  // Security headers with Helmet
  // Helmet sets secure defaults for various HTTP headers
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // vite/dev or inline chunks
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'", "/.netlify/functions/api"],
          frameAncestors: ["'none'"],
        },
      },
      // Prevent browsers from MIME-type sniffing
      noSniff: true,
      // Clickjacking protection
      frameguard: { action: "deny" },
      // Referrer policy
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      // HSTS (HTTP Strict Transport Security)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      // X-Powered-By header removal
      hidePoweredBy: true,
      // DNS prefetch control
      dnsPrefetchControl: { allow: false },
      // Disable X-UA-Compatible
      ieNoOpen: true,
      // Prevent browsers from accessing certain MIME types
      xssFilter: true,
    }),
  );

  // Application-specific security headers (set after Helmet)
  app.use((req, res, next) => {
    // Permissions Policy (formerly Feature Policy) - disable potentially sensitive APIs
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    // Client Hints for improved OS detection (Windows 11, etc.)
    res.setHeader("Accept-CH", "Sec-CH-UA-Platform-Version");
    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Extract user ID from authentication context for rate limiting
  app.use(extractUserIdMiddleware);

  // Apply database rate limiting to all API requests
  app.use("/api/", dbRateLimitMiddleware);

  // Stricter rate limiting for write operations
  app.use("/api/", strictDbRateLimitMiddleware);

  // Require a CSRF-style header for state-changing requests.
  // Enforce strict origin/referrer checks only in production (or when FORCE_STRICT_ORIGIN=true).
  app.use((req, res, next) => {
    const method = req.method.toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const csrfHeader =
        req.headers["x-requested-with"] || req.headers["x-csrf-token"];
      if (!csrfHeader) {
        return res.status(400).json({ error: "Missing CSRF header" });
      }

      // Only enforce strict origin checks if ALLOWED_ORIGINS is explicitly configured
      const isProdStrict =
        process.env.FORCE_STRICT_ORIGIN === "true" &&
        Boolean(process.env.ALLOWED_ORIGINS);
      if (isProdStrict) {
        const origin = (req.headers["origin"] as string) || "";
        const referer = (req.headers["referer"] as string) || "";
        const host =
          (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() ||
          (req.headers["host"] as string) ||
          "";

        // Build allowlist of hosts
        const allowedEnv = (process.env.ALLOWED_ORIGINS || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        // Accept both host:port and hostname-only to avoid false negatives across dev ports/proxies
        const getHostVariants = (h: string) => {
          const variants = new Set<string>();
          variants.add(h);
          const idx = h.indexOf(":");
          if (idx !== -1) variants.add(h.slice(0, idx));
          return variants;
        };

        const allowedHosts = new Set<string>();
        for (const v of getHostVariants(host)) allowedHosts.add(v);
        for (const v of allowedEnv) {
          try {
            const parsed = new URL(v);
            for (const hv of getHostVariants(parsed.host)) allowedHosts.add(hv);
          } catch {
            // If plain host provided without scheme
            for (const hv of getHostVariants(v)) allowedHosts.add(hv);
          }
        }

        const isAllowed = (url: string) => {
          try {
            const u = new URL(url);
            // Check either host (host:port) or hostname (no port)
            return allowedHosts.has(u.host) || allowedHosts.has(u.hostname);
          } catch {
            return false;
          }
        };

        if (
          (origin && !isAllowed(origin)) ||
          (referer && !isAllowed(referer))
        ) {
          return res.status(403).json({ error: "Invalid origin or referrer" });
        }
      }
    }
    next();
  });

  // Health and example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/healthz", (_req, res) => {
    res.json({ ok: true, time: Date.now() });
  });
  app.get("/api/readyz", async (_req, res) => {
    try {
      // Check if database is accessible
      const result = await getPool().query("SELECT 1 as ping");
      const ok = result.rowCount !== null && result.rowCount >= 0;
      res.json({
        ok,
        time: Date.now(),
        database: ok ? "connected" : "disconnected",
      });
    } catch (error) {
      console.error("Database readiness check failed:", error);
      res.status(503).json({
        ok: false,
        time: Date.now(),
        database: "disconnected",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/api/demo", handleDemo);

  // Auth API
  app.post("/api/auth/login", login);
  app.post("/api/auth/logout", logout);
  app.get("/api/auth/me", me);
  app.get("/api/auth/heartbeat", heartbeat);
  app.post("/api/auth/tab-opened", tabOpened);
  app.post("/api/auth/tab-closed", tabClosed);
  app.post("/api/auth/switch-role", switchRole);
  app.get("/api/auth/session-count/:username", getSessionCountHandler); // Public endpoint for login page

  // New Session/Heartbeat API
  app.post("/api/session/ping", sessionPing);
  app.post("/api/session/logout", logout);

  // Queue/Teller API
  app.get("/api/events", sseHandler); // SSE
  app.post("/api/tickets", requireRole(["reception"]), createTicket);
  app.get("/api/windows", listWindows);
  app.post(
    "/api/windows/:id/call-next",
    requireTellerForWindowParam("id"),
    callNext,
  );
  app.post(
    "/api/windows/:id/recall",
    requireTellerForWindowParam("id"),
    recall,
  );
  app.post(
    "/api/windows/:id/complete",
    requireTellerForWindowParam("id"),
    complete,
  );
  app.post("/api/windows/:id/skip", requireTellerForWindowParam("id"), skip);
  app.post(
    "/api/windows/:id/transfer",
    requireTellerForWindowParam("id"),
    transfer,
  );
  app.get("/api/display", displayData);
  app.get(
    "/api/teller/:id/stats",
    requireTellerForWindowParam("id"),
    tellerStats,
  );
  app.get(
    "/api/teller/:id/tickets",
    requireTellerForWindowParam("id"),
    tellerTickets,
  );

  // Employee API
  app.get("/api/employee/stats", requireRole(["employee"]), employeeStats);
  app.get(
    "/api/employee/tickets",
    requireRole(["employee"]),
    employeeReceivedTickets,
  );
  app.get("/api/employee/history", requireRole(["employee"]), employeeHistory);
  app.get(
    "/api/employee/performance",
    requireRole(["employee"]),
    employeePerformanceMetrics,
  );
  app.post("/api/employee/cases/start", requireRole(["employee"]), startCase);
  app.post(
    "/api/employee/cases/:id/start",
    requireRole(["employee"]),
    handleStartCase,
  );
  app.post(
    "/api/employee/cases/:id/proceed",
    requireRole(["employee"]),
    proceedCase,
  );
  app.post(
    "/api/employee/cases/:id/complete",
    requireRole(["employee"]),
    completeCase,
  );
  app.post("/api/employee/cases/:id/hold", requireRole(["employee"]), holdCase);
  app.post(
    "/api/employee/cases/:id/resume",
    requireRole(["employee"]),
    resumeCase,
  );
  app.get(
    "/api/employee/holds",
    requireRole(["employee", "teller", "admin", "archiever"]),
    getCaseHolds,
  );

  // Case workflow endpoints (public - for supervisors/tellers viewing completed case workflows)
  app.get("/api/employee/case-workflow", caseWorkflow);
  app.get("/api/employee/case-workflows", listCaseWorkflows);
  app.get("/api/employee/progress-flow", getStoredProgressFlow);

  // Field Visit Workflow endpoints
  app.post(
    "/api/employee/tickets/:ticketId/require-field-visit",
    requireRole(["employee", "admin"]),
    requireFieldVisit,
  );
  app.post(
    "/api/employee/field-visit-cases/:caseId/start",
    requireRole(["employee", "admin"]),
    startFieldWork,
  );
  app.post(
    "/api/employee/field-visit-cases/:caseId/complete",
    requireRole(["employee", "admin"]),
    completeFieldWork,
  );
  app.post(
    "/api/employee/field-visit-cases/:caseId/ready-for-service",
    requireRole(["employee", "admin"]),
    readyForService,
  );
  app.get(
    "/api/employee/field-visit-cases",
    requireRole(["employee", "admin"]),
    listFieldVisitCases,
  );
  app.get(
    "/api/employee/field-visit-cases/:caseId",
    requireRole(["employee", "admin"]),
    getFieldVisitCase,
  );

  // Archiever API
  app.get(
    "/api/archiever/documents",
    requireRole(["archiever"]),
    getWaitingDocumentsDb,
  );
  app.post(
    "/api/archiever/documents/:ticketId/fetch",
    requireRole(["archiever"]),
    markDocumentsFetched,
  );
  app.get(
    "/api/archiever/documents/:ticketId/status",
    requireRole(["archiever"]),
    getDocumentStatus,
  );

  // New Archiver Interface API Routes
  app.get(
    "/api/archiever/global-queue",
    requireRole(["archiever"]),
    getGlobalQueue,
  );
  app.post(
    "/api/archiever/tickets/:ticketId/start",
    requireRole(["archiever"]),
    startTicket,
  );
  app.get(
    "/api/archiever/tickets/:ticketId/details",
    requireRole(["archiever"]),
    getTicketDetails,
  );
  app.post(
    "/api/archiever/tickets/:ticketId/notes",
    requireRole(["archiever"]),
    addInternalNotes,
  );
  app.post(
    "/api/archiever/tickets/:ticketId/document-checklist",
    requireRole(["archiever"]),
    updateDocumentChecklist,
  );
  app.post(
    "/api/archiever/tickets/:ticketId/retrieved",
    requireRole(["archiever"]),
    markTicketRetrieved,
  );
  app.post(
    "/api/archiever/tickets/:ticketId/release",
    requireRole(["archiever"]),
    releaseTicket,
  );
  app.get(
    "/api/archiever/history",
    requireRole(["archiever"]),
    getArchivedHistory,
  );
  app.post(
    "/api/archiever/tickets/:ticketId/manually-archive",
    requireRole(["archiever"]),
    manuallyArchiveTicket,
  );

  app.get("/api/tickets/:code", getTicketStatus);
  app.get("/api/admin/sessions", requireRole(["admin"]), listSessionsHandler);
  app.delete("/api/admin/sessions/:sessionId", requireRole(["admin"]), revokeSessionHandler);
  app.post("/api/auth/revoke-all-sessions", revokeAllSessionsHandler); // Emergency cleanup - revokes all other sessions
  app.get("/api/admin/sessions-debug", debugSessionsHandler); // Debug endpoint without auth
  app.post("/api/admin/clear-demo", requireRole(["admin"]), clearDemo);
  app.post("/api/admin/seed-test-data", requireRole(["admin"]), seedTestData);
  app.get(
    "/api/admin/queue-settings",
    requireRole(["admin"]),
    getQueueSettings,
  );
  app.post(
    "/api/admin/queue-settings",
    requireRole(["admin"]),
    updateQueueSettings,
  );
  app.get("/api/admin/daily-report", requireRole(["admin"]), getDailyReport);
  app.get("/api/admin/overall-analytics", getOverallAnalytics); // Temporarily public for debugging
  app.get(
    "/api/admin/employee-stats",
    requireRole(["admin"]),
    getEmployeeStats,
  );

  // Service categories and services endpoints (public for reception console)
  app.get("/api/service-categories", listServiceCategories);
  app.get("/api/service-categories/:categoryId/services", getCategoryServices);

  // Window and user management endpoints
  app.get("/api/admin/users", listUsers); // Public read for transfer feature
  app.post("/api/admin/users", requireRole(["admin"]), createUser);
  app.put("/api/admin/users/:id", requireRole(["admin"]), updateUser);
  app.delete("/api/admin/users/:id", requireRole(["admin"]), deleteUser);
  app.post(
    "/api/admin/users/:userId/reset-password",
    requireRole(["admin"]),
    resetUserPassword,
  );
  app.get(
    "/api/admin/job-titles",
    requireRole(["admin", "employee", "teller", "archiever"]),
    listJobTitlesHandler,
  );
  app.get(
    "/api/admin/windows",
    requireRole(["admin"]),
    listWindowsForManagement,
  );
  app.post("/api/admin/windows", requireRole(["admin"]), createWindow);
  app.put("/api/admin/windows/:id", requireRole(["admin"]), updateWindow);
  app.delete("/api/admin/windows/:id", requireRole(["admin"]), deleteWindow);
  app.post(
    "/api/admin/windows/:windowId/reset-password",
    requireRole(["admin"]),
    resetWindowPassword,
  );
  app.post(
    "/api/admin/users/:userId/assign-window",
    requireRole(["admin"]),
    assignTellerToWindow,
  );

  // Window service restrictions endpoints
  app.get(
    "/api/admin/windows/:windowId/services",
    requireTellerForWindowParam("windowId"),
    getWindowServices,
  );
  app.put(
    "/api/admin/windows/:windowId/services",
    requireRole(["admin"]),
    setWindowServices,
  );

  // Service category endpoints
  app.post(
    "/api/admin/service-categories",
    requireRole(["admin"]),
    createServiceCategory,
  );
  app.put(
    "/api/admin/service-categories/:categoryId",
    requireRole(["admin"]),
    updateServiceCategory,
  );
  app.delete(
    "/api/admin/service-categories/:categoryId",
    requireRole(["admin"]),
    deleteServiceCategory,
  );

  // Service endpoints
  app.post("/api/admin/services", requireRole(["admin"]), createService);
  app.put(
    "/api/admin/services/:serviceId",
    requireRole(["admin"]),
    updateService,
  );
  app.delete(
    "/api/admin/services/:serviceId",
    requireRole(["admin"]),
    deleteService,
  );

  app.post("/api/admin/setup", setupAdmin);

  // Global error handler with sanitization and optional Sentry reporting
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(async (err: any, _req: any, res: any, _next: any) => {
    console.error("Error caught by global handler:", {
      message: err?.message,
      status: err?.status,
      code: err?.code,
      stack: err?.stack,
    });
    try {
      // Attempt dynamic Sentry integration if available
      if (process.env.SENTRY_DSN) {
        try {
          // @ts-ignore - Sentry is optional, may not be installed
          const S = await import("@sentry/node").catch(() => null);
          if (S?.init) {
            S.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.0 });
            S.captureException(err);
          }
        } catch {}
      }
    } catch {}
    const status = err?.status || 500;
    const message =
      status >= 500 ? "Internal Server Error" : String(err?.message || "Error");
    res.status(status).json({ error: message });
  });

  // Perform initial cleanup of stale sessions on startup
  (async () => {
    try {
      const cleaned = await cleanupAllStaleSessions();
      if (cleaned > 0) {
        console.log(`[Sessions] Initial cleanup removed ${cleaned} stale sessions`);
      }
    } catch (error) {
      console.error("[Sessions] Initial cleanup failed:", error);
    }
  })();

  // Periodic cleanup of stale sessions (every minute)
  setInterval(async () => {
    try {
      const cleaned = await cleanupAllStaleSessions();
      if (cleaned > 0) {
        console.log(`[Sessions] Cleaned up ${cleaned} stale sessions`);
      }
    } catch (error) {
      console.error("[Sessions] Cleanup failed:", error);
    }
  }, 1 * 60 * 1000);

  // Perform initial check for expired holds on startup
  (async () => {
    try {
      await autoCancelExpiredHolds();
    } catch (error) {
      console.error("[Holds] Initial expiration check failed:", error);
    }
  })();

  // Periodic check for expired holds (every 5 minutes)
  setInterval(async () => {
    try {
      await autoCancelExpiredHolds();
    } catch (error) {
      console.error("[Holds] Expiration check failed:", error);
    }
  }, 5 * 60 * 1000);

  return app;
}

/**
 * Setup WebSocket server for real-time functionality
 */
export function setupWebSocket(httpServer: HTTPServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws/admin/sessions"
  });

  wss.on("connection", (ws) => {
    handleAdminSessionConnection(ws);
  });

  wss.on("error", (error) => {
    console.error("[WebSocket Server] Error:", error);
  });

  console.log("[WebSocket] Server initialized at /ws/admin/sessions");
}

import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  clearDemo,
  getQueueSettings,
  updateQueueSettings,
  getDailyReport,
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
  login,
  logout,
  me,
  requireRole,
  requireTellerForWindowParam,
} from "./routes/auth";
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
      allowedHeaders: ["Content-Type", "X-Requested-With", "X-CSRF-Token"],
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

  // Security headers
  app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // vite/dev or inline chunks
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' /.netlify/functions/api",
      "frame-ancestors 'none'",
    ].join("; ");
    res.setHeader("Content-Security-Policy", csp);

    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }
    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  app.get("/api/tickets/:code", getTicketStatus);
  app.get("/api/admin/sessions", requireRole(["admin"]), listSessionsHandler);
  app.post("/api/admin/clear-demo", requireRole(["admin"]), clearDemo);
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
    requireRole(["admin", "employee", "teller"]),
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

  return app;
}

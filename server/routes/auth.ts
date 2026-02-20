import type { Request, Response, RequestHandler } from "express";
import {
  getUserByUsername,
  getUserByWindow,
  logAudit,
  getPool,
} from "../store/db";
import { parseCookies, verifyPassword } from "../utils/auth";
import type {
  AuthErrorCode,
  AuthUser,
  ListSessionsResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  UserRole,
} from "../../shared/api";
import {
  SESSION_COOKIE,
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  countActiveSessionsForUser,
  createUserSession,
  findSessionByToken,
  listSessions,
  revokeSessionById,
  revokeSessionByToken,
  revokeSessionsForUser,
  touchSession,
} from "../store/sessions";
import type { SessionRecord, SessionRevokeReason } from "../store/sessions";

// For production HTTPS, use SameSite=None with Secure flag
// For development HTTP, use SameSite=Lax without Secure flag
// Environment variable override: COOKIE_SAMESITE and COOKIE_SECURE
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "None").trim();
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" ||
  COOKIE_SAMESITE.toLowerCase() === "none";

// Log cookie configuration for debugging
if (
  process.env.NODE_ENV === "production" ||
  process.env.FORCE_HTTPS === "true"
) {
  console.log(
    `[Auth] Production mode - SameSite=${COOKIE_SAMESITE}, Secure=${COOKIE_SECURE}`,
  );
}

function toAuthUserFromRow(row: {
  id: string;
  username: string;
  role: UserRole;
  roles?: UserRole[];
  window_id: number | null;
  full_name?: string | null;
  job_title_id?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  position?: string | null;
}): AuthUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    roles: row.roles,
    windowId: row.window_id ?? null,
    fullName: row.full_name ?? undefined,
    jobTitleId: row.job_title_id ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    department: row.department ?? undefined,
    position: row.position ?? undefined,
  };
}

function toAuthUserFromSession(session: SessionRecord): AuthUser {
  return {
    id: session.userId,
    username: session.username,
    role: session.activeRole,
    windowId: session.windowId ?? null,
    jobTitleId: session.jobTitleId ?? undefined,
  };
}

function buildSessionCookie(token: string): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    `SameSite=${COOKIE_SAMESITE}`,
  ];
  if (COOKIE_SECURE) parts.push("Secure");
  return parts.join("; ");
}

function buildSessionClearCookie(): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    `SameSite=${COOKIE_SAMESITE}`,
  ];
  if (COOKIE_SECURE) parts.push("Secure");
  return parts.join("; ");
}

type AuthResult =
  | { ok: true; session: SessionRecord; token: string }
  | { ok: false; status: number; code: AuthErrorCode; message: string };

function sanitizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return null;
  return trimmed;
}

function ensurePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value || value.length > 200) return null;
  return value;
}

function mapRevokeReason(reason: SessionRevokeReason | null): {
  status: number;
  code: AuthErrorCode;
  message: string;
} {
  switch (reason) {
    case "conflict":
      return {
        status: 409,
        code: "SESSION_CONFLICT",
        message:
          "This account was signed in from another device. You have been logged out.",
      };
    case "logout":
      return {
        status: 401,
        code: "SESSION_INVALIDATED",
        message: "Your session has expired. Please sign in again.",
      };
    case "invalidated":
      return {
        status: 401,
        code: "SESSION_INVALIDATED",
        message: "Your session has expired. Please sign in again.",
      };
    case "timeout":
      return {
        status: 401,
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please sign in again.",
      };
    case "expired":
      return {
        status: 401,
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please sign in again.",
      };
    default:
      return {
        status: 401,
        code: "SESSION_INVALIDATED",
        message: "Your session has expired. Please sign in again.",
      };
  }
}

async function authenticateRequest(
  req: Request,
  res: Response,
  { touch }: { touch?: boolean } = {},
): Promise<AuthResult> {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    // Session cookie not found - this could be a new user or the cookie wasn't sent
    const hasCookieHeader = !!req.headers.cookie;
    console.warn(
      `[Auth] Session cookie not found. Cookie header present: ${hasCookieHeader}, Looking for: ${SESSION_COOKIE}`,
    );
    return {
      ok: false,
      status: 401,
      code: "NO_SESSION",
      message: "Authentication required.",
    };
  }
  const session = await findSessionByToken(token);
  if (!session) {
    console.warn(`[Auth] Session token not found in database for cookie`);
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    return {
      ok: false,
      status: 401,
      code: "SESSION_INVALIDATED",
      message: "Your session has expired. Please sign in again.",
    };
  }
  if (session.revokedAt) {
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    const mapped = mapRevokeReason(session.revokeReason ?? null);
    return { ok: false, ...mapped };
  }
  const now = new Date();
  if (now.getTime() > session.expiresAt.getTime()) {
    await revokeSessionById(session.id, "expired");
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    return {
      ok: false,
      status: 401,
      code: "SESSION_EXPIRED",
      message: "Session expired. Please sign in again.",
    };
  }
  const idleMs = now.getTime() - session.lastSeenAt.getTime();
  if (idleMs > SESSION_IDLE_TIMEOUT_SECONDS * 1000) {
    await revokeSessionById(session.id, "timeout");
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    return {
      ok: false,
      status: 401,
      code: "SESSION_EXPIRED",
      message: "Session ended due to inactivity. Please sign in again.",
    };
  }
  if (touch) {
    await touchSession(session.id, now);
  }
  return { ok: true, session, token };
}

// Simple in-memory rate limiting and lockout for login
const attemptsByKey = new Map<string, { count: number; resetAt: number }>();
const globalAttemptsByUser = new Map<
  string,
  { count: number; resetAt: number }
>();
const lockedUntilByUser = new Map<string, number>();
const lockedUntilByIpUser = new Map<string, number>();
function keyFor(req: Request, username: string) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "";
  return `${username.toLowerCase()}|${ip}`;
}
function incrementAttempt(
  req: Request,
  username: string,
  windowMs = 10 * 60 * 1000,
) {
  const key = keyFor(req, username);
  const now = Date.now();
  const entry = attemptsByKey.get(key);
  if (!entry || entry.resetAt < now) {
    attemptsByKey.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count += 1;
  attemptsByKey.set(key, entry);
  return entry.count;
}
function incrementGlobalAttempt(username: string, windowMs = 10 * 60 * 1000) {
  const key = username.toLowerCase();
  const now = Date.now();
  const entry = globalAttemptsByUser.get(key);
  if (!entry || entry.resetAt < now) {
    globalAttemptsByUser.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count += 1;
  globalAttemptsByUser.set(key, entry);
  return entry.count;
}
function isLocked(req: Request, username: string) {
  const ipKey = keyFor(req, username);
  const userKey = username.toLowerCase();
  const now = Date.now();

  const userUntil = lockedUntilByUser.get(userKey) || 0;
  if (now < userUntil) return true;

  const ipUntil = lockedUntilByIpUser.get(ipKey) || 0;
  if (now < ipUntil) return true;

  return false;
}
function lockUserByIp(req: Request, username: string, minutes = 15) {
  const ipKey = keyFor(req, username);
  const until = Date.now() + minutes * 60 * 1000;
  lockedUntilByIpUser.set(ipKey, until);
}
function lockUserGlobally(username: string, minutes = 15) {
  const userKey = username.toLowerCase();
  const until = Date.now() + minutes * 60 * 1000;
  lockedUntilByUser.set(userKey, until);
}

export const login: RequestHandler = async (req, res) => {
  const body = (req.body || {}) as LoginRequest & {
    otp?: string;
    mode?: string;
    role?: string;
  };
  const input = (body.username || "").trim();
  const password = ensurePassword(body.password);
  const desiredRole = (body.role || "").trim();

  if (!input || !password)
    return res.status(400).json({
      error: "Missing credentials",
      message: "Please enter your credentials and password.",
      code: "MISSING_CREDENTIALS",
    });

  // Determine if input is a window ID or username
  const windowId = Number(input);
  const isWindowInput = Number.isInteger(windowId) && windowId >= 1;

  let userRow;
  let loginKey: string;
  let isWindowLogin = false;

  if (isWindowInput) {
    isWindowLogin = true;
    console.log("🔐 Window login attempt:", {
      windowId,
      passwordLength: password?.length,
    });
    loginKey = `window_${windowId}`;
    if (isLocked(req, loginKey)) {
      return res.status(429).json({
        error: "Too many attempts. Try again later.",
        message: "Too many attempts. Try again later.",
        code: "RATE_LIMITED" as any,
      });
    }
    userRow = await getUserByWindow(windowId);
    console.log("👤 Window lookup:", { windowId, found: !!userRow });
  } else {
    console.log("🔐 User login attempt:", {
      username: input,
      passwordLength: password?.length,
    });
    loginKey = `user_${input}`;
    if (isLocked(req, loginKey)) {
      return res.status(429).json({
        error: "Too many attempts. Try again later.",
        message: "Too many attempts. Try again later.",
        code: "RATE_LIMITED" as any,
      });
    }
    userRow = await getUserByUsername(input);
    console.log("👤 User lookup:", { username: input, found: !!userRow });
  }

  if (!userRow) {
    const c = incrementAttempt(req, loginKey);
    if (c >= 10) lockUserByIp(req, loginKey, 15);
    const gc = incrementGlobalAttempt(loginKey);
    if (gc >= 50) lockUserGlobally(loginKey, 15);
    let errorMsg: string;
    let message: string;

    if (isWindowLogin) {
      // Check if window exists in database
      let windowExists = false;
      try {
        const pool = getPool();
        const windowCheck = await pool.query(
          `SELECT id FROM windows WHERE id = $1 LIMIT 1`,
          [windowId],
        );
        windowExists = windowCheck.rows.length > 0;
      } catch (err) {
        // If we can't check, use generic error
        windowExists = false;
      }

      if (windowExists) {
        // Window exists but has no teller assigned
        errorMsg = "teller not assign please assign";
        message =
          "No teller assigned to this window. Please assign a teller to this window.";
      } else {
        // Window doesn't exist
        errorMsg = "Invalid window or password";
        message = "Invalid window or password.";
      }
    } else {
      errorMsg = "Invalid username or password";
      message = "Invalid username or password.";
    }

    return res.status(401).json({
      error: errorMsg,
      message: message,
      code: "INVALID_CREDENTIALS",
    });
  }

  if (userRow.disabled) {
    const accountType = isWindowLogin ? "window" : userRow.role;
    return res.status(403).json({
      error: `This ${accountType} account has been locked or disabled. Please contact the administrator.`,
      message: `This ${accountType} account has been locked or disabled. Please contact the administrator.`,
      code: "ACCOUNT_DISABLED",
    });
  }

  const passwordMatch = verifyPassword(password, userRow.password_hash);
  console.log("🔑 Password verification:", {
    match: passwordMatch,
    passwordLength: password?.length,
    hashLength: userRow.password_hash?.length,
  });

  if (!passwordMatch) {
    const c = incrementAttempt(req, loginKey);
    if (c >= 10) lockUserByIp(req, loginKey, 15);
    const gc = incrementGlobalAttempt(loginKey);
    if (gc >= 50) lockUserGlobally(loginKey, 15);
    const errorMsg = isWindowLogin
      ? "Invalid window or password"
      : "Invalid username or password";
    return res.status(401).json({
      error: errorMsg,
      message: `${errorMsg}.`,
      code: "INVALID_CREDENTIALS",
    });
  }

  // Optional 2FA: require static code if configured
  const requiredOtp =
    (req.headers["x-otp"] as string) ||
    (req.headers["x-totp"] as string) ||
    (body as any).otp ||
    "";
  const configuredOtp = (process.env.TWO_FACTOR_STATIC_CODE || "").trim();
  if (configuredOtp) {
    if (!requiredOtp || requiredOtp !== configuredOtp) {
      return res.status(401).json({
        error: "Two-factor code required",
        message: "Two-factor code required.",
        code: "INVALID_CREDENTIALS",
      });
    }
  }

  // Determine the active role to use for this session
  // If desiredRole is specified and user has it, use it. Otherwise, use primary role.
  let activeRole = userRow.role;
  if (desiredRole && userRow.roles?.includes(desiredRole as any)) {
    activeRole = desiredRole as any;
  }

  // Validate that user has at least one role
  if (!activeRole) {
    console.error("User has no roles assigned:", {
      userId: userRow.id,
      username: userRow.username,
    });
    return res.status(500).json({
      error: "User configuration error",
      message:
        "User account is not properly configured. Please contact the administrator.",
      code: "USER_CONFIG_ERROR",
    });
  }

  // Check for active sessions limit
  const activeSessionCount = await countActiveSessionsForUser(userRow.id);

  // Reject login if already at limit - do not revoke existing sessions
  if (activeSessionCount >= 3) {
    return res.status(409).json({
      error: "Maximum session limit reached",
      message:
        "Maximum session limit reached. Please log out from another device to continue.",
      code: "MAX_SESSIONS_REACHED" as AuthErrorCode,
    });
  }

  // Success: create a new session
  const { token, session } = await createUserSession({
    userId: userRow.id,
    username: userRow.username,
    activeRole: activeRole,
    windowId: userRow.window_id ?? null,
    jobTitleId: userRow.job_title_id ?? null,
  });

  res.setHeader("Set-Cookie", buildSessionCookie(token));

  const user = toAuthUserFromRow(userRow);
  user.role = activeRole;
  user.roles = userRow.roles;
  try {
    await logAudit({
      action: "auth.login",
      userId: user.id,
      username: user.username,
      role: user.role,
      windowId: user.windowId ?? null,
    });
  } catch {}

  const payload: LoginResponse = {
    user,
    message: `Signed in as ${user.username}`,
  };

  (req as any).auth = {
    id: session.userId,
    username: session.username,
    role: session.activeRole,
    windowId: session.windowId ?? null,
    sessionId: session.id,
  };

  res.json(payload);
};

export const me: RequestHandler = async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];
  if (!token)
    return res.json({ user: null, errorCode: "NO_SESSION" } as MeResponse);

  const session = await findSessionByToken(token);
  if (!session) {
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    return res.json({
      user: null,
      errorCode: "SESSION_INVALIDATED",
      message: "Your session has expired. Please sign in again.",
    } as MeResponse);
  }
  if (session.revokedAt) {
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    const mapped = mapRevokeReason(session.revokeReason ?? null);
    return res.json({
      user: null,
      errorCode: mapped.code,
      message: mapped.message,
    } as MeResponse);
  }
  const now = new Date();
  if (now.getTime() > session.expiresAt.getTime()) {
    await revokeSessionById(session.id, "expired");
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    return res.json({
      user: null,
      errorCode: "SESSION_EXPIRED",
      message: "Session expired. Please sign in again.",
    } as MeResponse);
  }
  const idleMs = now.getTime() - session.lastSeenAt.getTime();
  if (idleMs > SESSION_IDLE_TIMEOUT_SECONDS * 1000) {
    await revokeSessionById(session.id, "timeout");
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    return res.json({
      user: null,
      errorCode: "SESSION_EXPIRED",
      message: "Session ended due to inactivity. Please sign in again.",
    } as MeResponse);
  }
  await touchSession(session.id, now);
  const user = toAuthUserFromSession(session);
  res.json({ user } as MeResponse);
};

export const logout: RequestHandler = async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];

  if (token) {
    try {
      const session = await findSessionByToken(token);
      if (session) {
        await revokeSessionById(session.id, "logout");
        await logAudit({
          action: "auth.logout",
          userId: session.userId,
          username: session.username,
          role: session.activeRole,
          windowId: session.windowId ?? null,
        });
      } else {
        await revokeSessionByToken(token, "logout");
      }
    } catch {}
  }

  res.setHeader("Set-Cookie", buildSessionClearCookie());
  res.json({ ok: true });
};

function respondWithAuthError(
  res: Response,
  error: { status: number; code: AuthErrorCode; message: string } | AuthResult,
) {
  if (!("ok" in error) || error.ok === false) {
    const err = error as any;
    return res
      .status(err.status)
      .json({ error: err.message, message: err.message, code: err.code });
  }
}

export function requireRole(roles: UserRole[]): RequestHandler {
  return async (req, res, next) => {
    const result = await authenticateRequest(req, res, { touch: true });
    if (!result.ok) return respondWithAuthError(res, result);

    const userRole = result.session.activeRole;
    const hasPermission = roles.includes(userRole);

    if (!hasPermission) {
      console.warn(
        `[Auth] Access denied: user role '${userRole}' not in allowed roles [${roles.join(", ")}]`,
        {
          userId: result.session.userId,
          username: result.session.username,
          userRole,
          allowedRoles: roles,
          path: req.path,
          method: req.method,
        },
      );
      return res.status(403).json({
        error:
          "Access denied. You do not have permission to perform this action.",
        message:
          "Access denied. You do not have permission to perform this action.",
        code: "UNAUTHORIZED" as AuthErrorCode,
      });
    }
    (req as any).auth = {
      id: result.session.userId,
      username: result.session.username,
      role: result.session.activeRole,
      windowId: result.session.windowId ?? null,
      sessionId: result.session.id,
    };
    next();
  };
}

export function requireTellerForWindowParam(paramName: string): RequestHandler {
  return async (req, res, next) => {
    const result = await authenticateRequest(req, res, { touch: true });
    if (!result.ok) return respondWithAuthError(res, result);
    const windowId = Number(req.params[paramName]);
    if (!Number.isInteger(windowId) || windowId <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid window id", message: "Invalid window id" });
    }

    const isAdmin = result.session.activeRole === "admin";
    const isTellerForWindow =
      result.session.activeRole === "teller" &&
      result.session.windowId === windowId;

    if (!isAdmin && !isTellerForWindow) {
      return res.status(403).json({
        error:
          "Access denied. You do not have permission to perform this action.",
        message:
          "Access denied. You do not have permission to perform this action.",
        code: "UNAUTHORIZED" as AuthErrorCode,
      });
    }

    (req as any).auth = {
      id: result.session.userId,
      username: result.session.username,
      role: result.session.activeRole,
      windowId: result.session.windowId ?? null,
      sessionId: result.session.id,
    };
    next();
  };
}

export const switchRole: RequestHandler = async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];
  if (!token)
    return res.status(401).json({
      error: "Not authenticated",
      message: "Please sign in first.",
      code: "NO_SESSION",
    });

  const session = await findSessionByToken(token);
  if (!session || session.revokedAt) {
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    return res.json({
      error: "Session invalid",
      message: "Your session has expired. Please sign in again.",
      code: "SESSION_INVALIDATED",
    });
  }

  const body = (req.body || {}) as { role?: string };
  const desiredRole = (body.role || "").trim() as UserRole;

  if (!desiredRole) {
    return res.status(400).json({
      error: "Missing role",
      message: "Please specify a role to switch to.",
    });
  }

  if (
    !["reception", "teller", "admin", "employee", "archiever"].includes(
      desiredRole,
    )
  ) {
    return res.status(400).json({
      error: "Invalid role",
      message: "The specified role is not valid.",
    });
  }

  // Get user's available roles from the database
  const p = getPool();
  const { rows } = await p.query(
    `SELECT role FROM user_roles WHERE user_id = $1 ORDER BY is_primary DESC`,
    [session.userId],
  );

  const availableRoles = rows.map((r) => r.role as UserRole);

  if (!availableRoles.includes(desiredRole)) {
    return res.status(403).json({
      error: "Access denied",
      message: `You do not have permission to access the ${desiredRole} role.`,
      code: "UNAUTHORIZED",
    });
  }

  // Update the session's active role
  await p.query(`UPDATE user_sessions SET active_role = $2 WHERE id = $1`, [
    session.id,
    desiredRole,
  ]);

  // Fetch the updated session
  const updatedSession = await findSessionByToken(token);
  if (!updatedSession) {
    return res.status(500).json({
      error: "Failed to switch role",
      message: "Could not update your session.",
    });
  }

  const user = toAuthUserFromSession(updatedSession);
  res.json({ user, message: `Switched to ${desiredRole} role` });
};

export const listSessionsHandler: RequestHandler = async (req, res) => {
  try {
    const auth = (req as any).auth;
    console.log("[listSessionsHandler] Request received", {
      method: req.method,
      path: req.path,
      username: auth?.username || "no-auth",
      role: auth?.role || "no-role",
      hasCookie: !!req.headers.cookie,
    });

    const sessions = await listSessions();
    console.log(
      "[listSessionsHandler] Successfully fetched sessions, count:",
      sessions.length,
    );

    const payload: ListSessionsResponse = { sessions };
    res.header("Content-Type", "application/json");
    res.json(payload);
  } catch (error) {
    console.error(
      "[listSessionsHandler] Error fetching sessions:",
      error instanceof Error ? error.message : error,
    );
    res.status(500).json({
      error: "Failed to fetch sessions",
      sessions: [],
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Debug endpoint for testing sessions (no auth required)
export const debugSessionsHandler: RequestHandler = async (_req, res) => {
  try {
    console.log("[debugSessionsHandler] Debug request received");
    const sessions = await listSessions();
    console.log(
      "[debugSessionsHandler] Sessions fetched, count:",
      sessions.length,
    );

    res.json({
      success: true,
      count: sessions.length,
      sessions: sessions.slice(0, 5), // Return first 5 for debugging
    });
  } catch (error) {
    console.error("[debugSessionsHandler] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Revoke a specific session by ID
export const revokeSessionHandler: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const auth = (req as any).auth;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Revoke the session
    await revokeSessionById(sessionId, "invalidated");

    // Log the audit
    await logAudit({
      action: "auth.session_revoked",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { revokedSessionId: sessionId },
    });

    res.json({ ok: true, message: "Session revoked successfully" });
  } catch (error) {
    console.error("[revokeSessionHandler] Error:", error);
    res.status(500).json({
      error: "Failed to revoke session",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Revoke all sessions for current user (cleanup endpoint for emergency)
export const revokeAllSessionsHandler: RequestHandler = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[SESSION_COOKIE];

    if (!token) {
      return res.status(401).json({
        error: "No session found",
        message: "Please provide a valid session token",
        code: "NO_SESSION",
      });
    }

    // Find the session to get user ID
    const session = await findSessionByToken(token);
    if (!session) {
      return res.status(401).json({
        error: "Session invalid",
        message: "Your session is invalid",
        code: "SESSION_INVALIDATED",
      });
    }

    // Revoke all sessions for this user EXCEPT the current one
    await revokeSessionsForUser(session.userId, "invalidated", session.id);

    // Log the audit
    await logAudit({
      action: "auth.all_sessions_revoked",
      userId: session.userId,
      username: session.username,
      role: session.activeRole,
      details: { currentSessionKept: session.id },
    });

    res.json({
      ok: true,
      message: "All other sessions revoked successfully. You remain logged in.",
    });
  } catch (error) {
    console.error("[revokeAllSessionsHandler] Error:", error);
    res.status(500).json({
      error: "Failed to revoke sessions",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

// Get active session count for a username (public endpoint for login page)
export const getSessionCountHandler: RequestHandler = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username || typeof username !== "string") {
      return res.status(400).json({
        error: "Username is required",
        message: "Please provide a valid username",
      });
    }

    // Get user by username
    const user = await getUserByUsername(username);
    if (!user) {
      // Don't reveal if user exists - return 0 for security
      return res.json({ username, activeSessionCount: 0, isBlocked: false });
    }

    // Check if user is locked/blocked
    const loginKey = `user_${username}`;
    const blocked = isLocked(req, loginKey);

    // Get active session count
    const activeSessionCount = await countActiveSessionsForUser(user.id);

    res.json({
      username: user.username,
      activeSessionCount,
      maxSessions: 3,
      canLogin: activeSessionCount < 3,
      isBlocked: blocked,
    });
  } catch (error) {
    console.error("[getSessionCountHandler] Error:", error);
    res.status(500).json({
      error: "Failed to get session count",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

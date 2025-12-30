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
  window_id: number | null;
  full_name?: string | null;
  job_title_id?: string | null;
}): AuthUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    windowId: row.window_id ?? null,
    fullName: row.full_name ?? undefined,
    jobTitleId: row.job_title_id ?? undefined,
  };
}

function toAuthUserFromSession(session: SessionRecord): AuthUser {
  return {
    id: session.userId,
    username: session.username,
    role: session.role,
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
const lockedUntilByUser = new Map<string, number>();
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
function isLocked(username: string) {
  const until = lockedUntilByUser.get(username.toLowerCase()) || 0;
  return Date.now() < until;
}
function lockUser(username: string, minutes = 15) {
  const until = Date.now() + minutes * 60 * 1000;
  lockedUntilByUser.set(username.toLowerCase(), until);
}

export const login: RequestHandler = async (req, res) => {
  const body = (req.body || {}) as LoginRequest & {
    otp?: string;
    mode?: string;
  };
  const input = (body.username || "").trim();
  const password = ensurePassword(body.password);
  const mode = (body.mode || "").trim();

  if (!input || !password)
    return res.status(400).json({
      error: "Missing credentials",
      message: "Please enter your credentials and password.",
      code: "MISSING_CREDENTIALS",
    });

  // Determine if input is a window ID or username
  const windowId = Number(input);
  const isWindowInput = Number.isInteger(windowId) && windowId >= 1;

  // Validate mode matches input type
  if (mode === "window" && !isWindowInput) {
    return res.status(401).json({
      error: "Invalid window number",
      message: "Window login requires a valid window number.",
      code: "INVALID_CREDENTIALS",
    });
  }

  if ((mode === "reception" || mode === "admin") && isWindowInput) {
    return res.status(401).json({
      error: "Invalid credentials",
      message: `Invalid username or password.`,
      code: "INVALID_CREDENTIALS",
    });
  }

  let userRow;
  let loginKey: string;
  let isWindowLogin = false;

  if (mode === "window" || (isWindowInput && !mode)) {
    isWindowLogin = true;
    console.log("🔐 Window login attempt:", {
      windowId,
      passwordLength: password?.length,
    });
    loginKey = `window_${windowId}`;
    if (isLocked(loginKey)) {
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
      mode,
      passwordLength: password?.length,
    });
    loginKey = `user_${input}`;
    if (isLocked(loginKey)) {
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
    if (c >= 10) lockUser(loginKey, 15);
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

  // Validate role matches login mode
  if (mode === "window" && userRow.role !== "teller") {
    const c = incrementAttempt(req, loginKey);
    if (c >= 10) lockUser(loginKey, 15);
    return res.status(401).json({
      error: "Invalid window or password",
      message: "Invalid window or password.",
      code: "INVALID_CREDENTIALS",
    });
  }

  if (mode === "reception" && userRow.role !== "reception") {
    const c = incrementAttempt(req, loginKey);
    if (c >= 10) lockUser(loginKey, 15);
    return res.status(401).json({
      error: "Invalid username or password",
      message: "Invalid username or password.",
      code: "INVALID_CREDENTIALS",
    });
  }

  if (mode === "admin" && userRow.role !== "admin") {
    const c = incrementAttempt(req, loginKey);
    if (c >= 10) lockUser(loginKey, 15);
    return res.status(401).json({
      error: "Invalid username or password",
      message: "Invalid username or password.",
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
    if (c >= 10) lockUser(loginKey, 15);
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

  // Success: rotate sessions by revoking previous
  await revokeSessionsForUser(userRow.id, "conflict");
  const { token, session } = await createUserSession({
    userId: userRow.id,
    username: userRow.username,
    role: userRow.role,
    windowId: userRow.window_id ?? null,
    jobTitleId: userRow.job_title_id ?? null,
  });

  res.setHeader("Set-Cookie", buildSessionCookie(token));

  const user = toAuthUserFromRow(userRow);
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
    role: session.role,
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
          role: session.role,
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

    const userRole = result.session.role;
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
      role: result.session.role,
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

    const isAdmin = result.session.role === "admin";
    const isTellerForWindow =
      result.session.role === "teller" && result.session.windowId === windowId;

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
      role: result.session.role,
      windowId: result.session.windowId ?? null,
      sessionId: result.session.id,
    };
    next();
  };
}

export const listSessionsHandler: RequestHandler = async (_req, res) => {
  const sessions = await listSessions();
  const payload: ListSessionsResponse = { sessions };
  res.json(payload);
};

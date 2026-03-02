import type { Request, Response, RequestHandler } from "express";
import { UAParser } from "ua-parser-js";
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
  createUserSessionAtomic,
  decrementTabCount,
  findSessionByToken,
  incrementTabCount,
  listSessions,
  revokeSessionById,
  revokeSessionByToken,
  revokeSessionsForUser,
  touchSession,
} from "../store/sessions";
import type { SessionRecord, SessionRevokeReason } from "../store/sessions";
import { broadcastSessionUpdate } from "../services/session-websocket";

// For production HTTPS, use SameSite=None with Secure flag
// For development HTTP, use SameSite=Lax without Secure flag
// Environment variable override: COOKIE_SAMESITE and COOKIE_SECURE
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "None").trim();
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" ||
  COOKIE_SAMESITE.toLowerCase() === "none";

// Maximum concurrent sessions per user (can be overridden via MAX_SESSIONS_PER_USER env var)
const MAX_SESSIONS_PER_USER = parseInt(
  process.env.MAX_SESSIONS_PER_USER || "3",
  10,
);

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
  const idleMs = now.getTime() - session.lastActivityAt.getTime();
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
// Helper function to extract and clean IP address
function getClientIpAddress(req: Request): string {
  // Try x-forwarded-for first (for proxies like Nginx, CloudFlare)
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor && typeof xForwardedFor === "string") {
    const ip = xForwardedFor.split(",")[0]?.trim() || "";
    if (ip) return cleanIpAddress(ip);
  }

  // Fallback to socket remote address
  const socketIp = req.socket?.remoteAddress || "";
  if (socketIp) return cleanIpAddress(socketIp);

  return "";
}

// Helper function to clean IPv6-mapped IPv4 addresses
function cleanIpAddress(ip: string): string {
  if (!ip) return "";
  // Remove ::ffff: prefix from IPv6-mapped IPv4 addresses
  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }
  // Remove brackets for IPv6 addresses
  if (ip.startsWith("[") && ip.endsWith("]")) {
    return ip.slice(1, -1);
  }
  return ip;
}

function keyFor(req: Request, username: string) {
  const ip = getClientIpAddress(req);
  return `${username.toLowerCase()}|${ip}`;
}

/**
 * Normalizes OS name and version from ua-parser-js result with support for:
 * 1. Android detection (when User-Agent contains both "Linux" and "Android")
 * 2. Windows 11 detection via Client Hints (Sec-CH-UA-Platform-Version header)
 *
 * IMPORTANT: Uses ua-parser-js result.os.name and result.os.version only.
 * Does NOT use engine, cpu, or other fields to avoid confusion.
 */
function normalizeOsDetection(
  uaResult: { os: { name: string | null; version: string | null } },
  req: Request,
): { osName: string; osVersion: string } {
  // Extract OS info directly from ua-parser-js os object
  let osName = uaResult.os.name || "Unknown";
  let osVersion = uaResult.os.version || "";
  const userAgent = (req.headers["user-agent"] || "").toLowerCase();

  const isDebugEnabled = process.env.DEBUG_OS_DETECTION === "true";
  if (isDebugEnabled) {
    console.log("[OS Detection] Initial parse:", {
      osName,
      osVersion,
      userAgent: userAgent.substring(0, 100),
    });
  }

  // ==============================================================================
  // Android Detection: Fix false "Linux" classification
  // ==============================================================================
  // ua-parser-js may report "Linux" when User-Agent contains both "Linux" and
  // "Android" string. Android devices are Linux-based but should display as "Android".
  // Precedence: If Android string exists in UA, always use "Android" over "Linux".
  if (osName === "Linux" && userAgent.includes("android")) {
    osName = "Android";
    if (isDebugEnabled) {
      console.log("[OS Detection] Android detected (Linux + Android in UA)");
    }
  }

  // ==============================================================================
  // Windows 11 Detection: Use Client Hints for accurate version
  // ==============================================================================
  // Background:
  // - Windows 11 uses same kernel as Windows 10 (NT 10.0)
  // - User-Agent alone cannot distinguish Windows 10 from Windows 11
  // - Client Hints (Sec-CH-UA-Platform-Version) provide accurate platform version
  // - Windows 11 reports platform version >= 13, Windows 10 reports <= 10
  // - Fallback: Without Client Hints, ua-parser-js will report "10" (kernel version)
  if (osName === "Windows" && osVersion === "10") {
    // Check for Sec-CH-UA-Platform-Version header sent by browser
    const platformVersion = req.headers["sec-ch-ua-platform-version"] as
      | string
      | undefined;

    if (platformVersion && platformVersion.trim()) {
      try {
        // Extract major version number from platform version string
        // Examples: "13.0", "13.0.1", "14.5" -> major version = 13, 14
        const versionParts = platformVersion.trim().split(".");
        const majorVersion = parseInt(versionParts[0], 10);

        // Validate parsed version is a reasonable number
        if (Number.isFinite(majorVersion) && majorVersion > 0) {
          // Windows 11: major version >= 13
          // Windows 10: major version <= 10
          // Windows 12+ (future): major version >= 13+
          if (majorVersion >= 13) {
            osVersion = "11";
            if (isDebugEnabled) {
              console.log("[OS Detection] Windows 11 detected via Client Hints", {
                platformVersion,
                majorVersion,
              });
            }
          }
        }
      } catch (error) {
        if (isDebugEnabled) {
          console.log(
            "[OS Detection] Failed to parse platform version:",
            platformVersion,
            error instanceof Error ? error.message : String(error),
          );
        }
        // Fall back to osVersion === "10" if parsing fails
      }
    } else if (isDebugEnabled) {
      console.log(
        "[OS Detection] Windows 10 detected (no Client Hints available)",
        { clientHintsHeader: platformVersion },
      );
    }
  }

  if (isDebugEnabled) {
    console.log("[OS Detection] Final result:", { osName, osVersion });
  }

  return { osName, osVersion };
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

  // Screen width-based role restriction:
  // - When screen width < 1024px: only admin role can login
  // - When screen width >= 1024px: all user roles can login
  const screenWidth = (body as any).screenWidth || 1024; // Default to 1024 if not provided
  const isSmallScreen = screenWidth < 1024;
  console.log("📏 Login screenWidth:", {
    receivedScreenWidth: (body as any).screenWidth,
    finalScreenWidth: screenWidth,
    isSmallScreen,
    userRole: userRow.role,
  });

  if (isSmallScreen && userRow.role !== "admin") {
    const c = incrementAttempt(req, loginKey);
    if (c >= 10) lockUserByIp(req, loginKey, 15);
    const gc = incrementGlobalAttempt(loginKey);
    if (gc >= 50) lockUserGlobally(loginKey, 15);
    return res.status(403).json({
      error: "Admin access only on small screens",
      message: "Only admin users can log in on screens smaller than 1024px. Please use a larger screen or contact your administrator.",
      code: "UNAUTHORIZED" as AuthErrorCode,
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

  // Capture device and browser info
  const parser = new UAParser(req.headers["user-agent"]);
  const uaResult = parser.getResult();

  // Extract and normalize OS details
  const { osName, osVersion } = normalizeOsDetection(uaResult as any, req);

  // Extract device details
  let deviceVendor = uaResult.device.vendor || "";
  let deviceModel = uaResult.device.model || "";
  const isBot = uaResult.ua?.toLowerCase().includes("bot");
  const deviceType = uaResult.device.type || "desktop";

  // Filter out single-character or obviously invalid device info (like "K", "X", etc.)
  // These are often parsing artifacts and not real device names
  if (deviceVendor && deviceVendor.length <= 2) {
    deviceVendor = "";
  }
  if (deviceModel && deviceModel.length <= 2) {
    deviceModel = "";
  }

  // Device restriction: Non-admin users can only access from desktop when screen width < 1024px
  if (isSmallScreen && activeRole !== "admin" && (deviceType === "mobile" || deviceType === "tablet")) {
    return res.status(403).json({
      error: "Desktop only access",
      message: "Non-admin users can only access from desktop browsers on small screens. Please use a larger screen or contact your administrator.",
      code: "DEVICE_NOT_ALLOWED" as AuthErrorCode,
    });
  }

  // Build device string based on device type
  let device: string;

  // Helper to check if we have any meaningful vendor or model info
  const hasDeviceInfo = (vendor: string, model: string): boolean => {
    return !!(vendor || model);
  };

  if (deviceType === "mobile" || deviceType === "tablet") {
    // For mobile/tablet, show vendor and/or model if available
    if (hasDeviceInfo(deviceVendor, deviceModel)) {
      // Show vendor + model, or just model/vendor if one is missing
      device = `${deviceVendor || ""} ${deviceModel || ""}`.trim();
    } else {
      // Fallback based on OS if no vendor/model info at all
      if (osName === "Android") {
        device = "Android Device";
      } else if (osName === "iOS") {
        device = "iOS Device";
      } else {
        device = deviceType === "tablet" ? "Tablet" : "Mobile Device";
      }
    }
  } else {
    // For desktop, show vendor/model if available
    if (hasDeviceInfo(deviceVendor, deviceModel)) {
      device = `${deviceVendor || ""} ${deviceModel || ""}`.trim();
    } else {
      device = osName.includes("Windows") ? "Windows PC" : osName.includes("Mac") ? "Mac" : "Desktop";
    }
  }

  // Extract browser details
  const browserName = uaResult.browser.name || "Unknown";
  const browserVersion = uaResult.browser.version || "";
  const browser = `${browserName}${browserVersion ? ` ${browserVersion}` : ""}`.trim();

  // Legacy fields for backward compatibility
  const os = `${osName}${osVersion ? ` ${osVersion}` : ""}`.trim();

  // Extract and clean IP address
  const ipAddress = getClientIpAddress(req);

  // Atomic session creation with limit enforcement and race condition prevention
  const sessionResult = await createUserSessionAtomic({
    userId: userRow.id,
    username: userRow.username,
    activeRole: activeRole,
    windowId: userRow.window_id ?? null,
    jobTitleId: userRow.job_title_id ?? null,
    maxSessions: MAX_SESSIONS_PER_USER,
    device,
    browser,
    os,
    ipAddress,
    osName,
    osVersion,
    deviceVendor,
    deviceModel,
    browserName,
    browserVersion,
  });

  if ("error" in sessionResult) {
    // Log the max sessions reached event for security auditing
    await logAudit({
      action: "auth.max_sessions_reached",
      userId: userRow.id,
      username: userRow.username,
      role: activeRole,
      windowId: userRow.window_id ?? null,
      details: {
        maxSessions: MAX_SESSIONS_PER_USER,
        ipAddress: getClientIpAddress(req),
        device: device,
        browser: browser,
      },
    });

    return res.status(409).json({
      error: "Maximum session limit reached",
      message:
        "Maximum session limit reached. Please log out from another device to continue.",
      code: "MAX_SESSIONS_REACHED" as AuthErrorCode,
    });
  }

  const { token, session } = sessionResult;

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

  // Broadcast session update to all admin clients
  broadcastSessionUpdate().catch((err) =>
    console.error("[SessionWS] Failed to broadcast after login:", err)
  );
};

export const me: RequestHandler = async (req, res) => {
  const result = await authenticateRequest(req, res, { touch: true });
  if (!result.ok) {
    // Return JSON response instead of letting authenticateRequest handle it
    const err = result as any;
    return res.json({
      user: null,
      errorCode: err.code,
      message: err.message,
    } as MeResponse);
  }

  const session = result.session;

  // Fetch full user data from database to include email, phone, department, etc.
  const p = getPool();
  const { rows } = await p.query(
    `SELECT u.id, u.username, u.password_hash, u.window_id, u.disabled, u.full_name, u.job_title_id, u.phone, u.email, u.department
     FROM users u
     WHERE u.id=$1 LIMIT 1`,
    [session.userId],
  );

  if (!rows[0]) {
    // User no longer exists
    await revokeSessionById(session.id, "invalidated");
    res.setHeader("Set-Cookie", buildSessionClearCookie());
    return res.json({
      user: null,
      errorCode: "SESSION_INVALIDATED",
      message: "Your account no longer exists.",
    } as MeResponse);
  }

  const userRow = rows[0];
  const user = toAuthUserFromRow(userRow);
  user.role = session.activeRole;
  user.roles = [session.activeRole]; // Set roles to current active role

  res.json({ user } as MeResponse);
};

export const heartbeat: RequestHandler = async (req, res) => {
  const result = await authenticateRequest(req, res, { touch: true });
  if (!result.ok) {
    // Only log authentication failures for heartbeat, not every successful heartbeat
    // to avoid excessive logging
    if ((result as any).code === "SESSION_EXPIRED" || (result as any).code === "SESSION_INVALIDATED") {
      try {
        const cookies = parseCookies(req.headers.cookie || "");
        const token = cookies[SESSION_COOKIE];
        const session = token ? await findSessionByToken(token) : null;
        if (session) {
          await logAudit({
            action: "auth.heartbeat_failed",
            userId: session.userId,
            username: session.username,
            role: session.activeRole,
            windowId: session.windowId ?? null,
            details: {
              sessionId: session.id,
              reason: (result as any).code,
            },
          });
        }
      } catch {}
    }
    return respondWithAuthError(res, result);
  }
  res.json({ ok: true, lastActivityAt: result.session.lastActivityAt.getTime() });
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

  // Broadcast session update to all admin clients
  broadcastSessionUpdate().catch((err) =>
    console.error("[SessionWS] Failed to broadcast after logout:", err)
  );
};

export const tabOpened: RequestHandler = async (req, res) => {
  const result = await authenticateRequest(req, res, { touch: true });
  if (!result.ok) return respondWithAuthError(res, result);

  await incrementTabCount(result.session.id);
  res.json({ ok: true, tabCount: result.session.tabCount + 1 });
};

export const tabClosed: RequestHandler = async (req, res) => {
  const result = await authenticateRequest(req, res, { touch: false });
  if (!result.ok) return respondWithAuthError(res, result);

  await decrementTabCount(result.session.id);
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

/**
 * Middleware that automatically touches (updates last_activity_at) authenticated sessions.
 * Should be applied to all routes that require authentication.
 * This ensures that active sessions stay alive as long as they're being used.
 */
export function requireAuthentication(): RequestHandler {
  return async (req, res, next) => {
    const result = await authenticateRequest(req, res, { touch: true });
    if (!result.ok) return respondWithAuthError(res, result);

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

  // Audit log for role change
  await logAudit({
    action: "auth.role_switched",
    userId: session.userId,
    username: session.username,
    role: desiredRole,
    windowId: session.windowId ?? null,
    details: {
      sessionId: session.id,
      previousRole: session.activeRole,
      newRole: desiredRole,
    },
  });

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

    // Broadcast session update to all admin clients
    broadcastSessionUpdate().catch((err) =>
      console.error("[SessionWS] Failed to broadcast after revoke:", err)
    );
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

    // Broadcast session update to all admin clients
    broadcastSessionUpdate().catch((err) =>
      console.error("[SessionWS] Failed to broadcast after revoke all:", err)
    );
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
    const blocked = isLocked(req, username);

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

/**
 * sessionPing handler for the new /api/session/ping endpoint.
 * Requirements:
 * 1. POST request
 * 2. Updates last_activity_at (via touch: true)
 * 3. Securely handles credentials (via cookies)
 */
export const sessionPing: RequestHandler = async (req, res) => {
  const result = await authenticateRequest(req, res, { touch: true });
  if (!result.ok) return respondWithAuthError(res, result);
  res.json({ ok: true, lastActivityAt: result.session.lastActivityAt.getTime() });
};

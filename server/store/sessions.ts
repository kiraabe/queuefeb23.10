import { createHash, randomBytes } from "node:crypto";
import type { SessionSummary, UserRole } from "../../shared/api";
import { getPool, logAudit } from "./db";
import { getGeolocation } from "../utils/geolocation";

// ─── Config ───────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = process.env.AUTH_COOKIE_NAME ?? "queue_session";

function parseNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[session] Invalid value for env var ${key}="${raw}". Using fallback: ${fallback}`,
    );
    return fallback;
  }
  return parsed;
}

export const SESSION_IDLE_TIMEOUT_SECONDS = parseNumberEnv(
  "SESSION_IDLE_TIMEOUT_SECONDS",
  1800, // 30 minutes
);

// How many seconds of inactivity marks a teller as unavailable for transfers.
// Defaults to SESSION_IDLE_TIMEOUT_SECONDS if not explicitly configured.
export const TRANSFER_AVAILABILITY_CHECK_SECONDS = parseNumberEnv(
  "TRANSFER_AVAILABILITY_CHECK_SECONDS",
  SESSION_IDLE_TIMEOUT_SECONDS,
);

export const SESSION_MAX_AGE_SECONDS = parseNumberEnv(
  "SESSION_TTL_SECONDS",
  24 * 60 * 60, // 24 hours
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionRevokeReason =
  | "logout"
  | "conflict"
  | "expired"
  | "timeout"
  | "invalidated"
  | "unknown";

export interface SessionRecord {
  id: string;
  userId: string;
  username: string;
  activeRole: UserRole;
  windowId: number | null;
  jobTitleId: string | null;
  tokenHash: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  device: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  tabCount: number;
  osName: string | null;
  osVersion: string | null;
  deviceVendor: string | null;
  deviceModel: string | null;
  browserName: string | null;
  browserVersion: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  revokedAt: Date | null;
  revokeReason: SessionRevokeReason | null;
}

/** Typed shape of a raw DB row returned from user_sessions queries. */
interface DbSessionRow {
  id: string;
  user_id: string;
  username: string;
  active_role: UserRole;
  window_id: number | null;
  job_title_id: string | null;
  token_hash: string;
  created_at: Date;
  last_activity_at: Date;
  expires_at: Date;
  device: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  tab_count: number | null;
  os_name: string | null;
  os_version: string | null;
  device_vendor: string | null;
  device_model: string | null;
  browser_name: string | null;
  browser_version: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  revoked_at: Date | null;
  revoke_reason: string | null;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export function generateSessionToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Row mapping ──────────────────────────────────────────────────────────────

function mapRow(row: DbSessionRow): SessionRecord {
  return {
    id:             row.id,
    userId:         row.user_id,
    username:       row.username,
    activeRole:     row.active_role,
    windowId:       row.window_id   ?? null,
    jobTitleId:     row.job_title_id ?? null,
    tokenHash:      row.token_hash,
    createdAt:      new Date(row.created_at),
    lastActivityAt: new Date(row.last_activity_at),
    expiresAt:      new Date(row.expires_at),
    device:         row.device        ?? null,
    browser:        row.browser       ?? null,
    os:             row.os            ?? null,
    ipAddress:      row.ip_address    ?? null,
    tabCount:       row.tab_count     ?? 1,
    osName:         row.os_name       ?? null,
    osVersion:      row.os_version    ?? null,
    deviceVendor:   row.device_vendor ?? null,
    deviceModel:    row.device_model  ?? null,
    browserName:    row.browser_name  ?? null,
    browserVersion: row.browser_version ?? null,
    country:        row.country       ?? null,
    countryCode:    row.country_code  ?? null,
    city:           row.city          ?? null,
    region:         row.region        ?? null,
    revokedAt:      row.revoked_at ? new Date(row.revoked_at) : null,
    revokeReason:   (row.revoke_reason as SessionRevokeReason | null) ?? null,
  };
}

// ─── Session status ───────────────────────────────────────────────────────────

export function sessionExpired(
  session: SessionRecord,
  now = new Date(),
): boolean {
  if (session.revokedAt) return true;
  if (now.getTime() > session.expiresAt.getTime()) return true;
  if (now.getTime() - session.lastActivityAt.getTime() > SESSION_IDLE_TIMEOUT_SECONDS * 1000)
    return true;
  return false;
}

export function toSummary(
  session: SessionRecord,
  fullName?: string | null,
  jobTitle?: string | null,
  now = Date.now(),
): SessionSummary {
  const expired = now > session.expiresAt.getTime();
  const idle    = now - session.lastActivityAt.getTime() > SESSION_IDLE_TIMEOUT_SECONDS * 1000;
  const status  = session.revokedAt ? "revoked" : expired || idle ? "expired" : "active";

  return {
    id:             session.id,
    username:       session.username,
    role:           session.activeRole,
    windowId:       session.windowId,
    createdAt:      session.createdAt.getTime(),
    lastSeenAt:     session.lastActivityAt.getTime(),
    expiresAt:      session.expiresAt.getTime(),
    status,
    device:         session.device,
    browser:        session.browser,
    os:             session.os,
    ipAddress:      session.ipAddress,
    osName:         session.osName,
    osVersion:      session.osVersion,
    deviceVendor:   session.deviceVendor,
    deviceModel:    session.deviceModel,
    browserName:    session.browserName,
    browserVersion: session.browserVersion,
    country:        session.country,
    countryCode:    session.countryCode,
    city:           session.city,
    region:         session.region,
    tabCount:       session.tabCount,
    revokeReason:   session.revokeReason ?? null,
    fullName:       fullName  ?? null,
    jobTitle:       jobTitle  ?? null,
  };
}

// ─── Stale-session cleanup (shared helper) ────────────────────────────────────
//
// Cleans up idle, expired, and zero-tab sessions for a given user_id (when
// provided) or across ALL users (when omitted). Must be called inside an
// existing transaction when used from createUserSessionAtomic so that the
// cleanup and the INSERT are atomic.

interface CleanupOptions {
  /** Postgres client to reuse inside a transaction, or omit to use the pool. */
  client?: { query: typeof getPool extends () => infer P ? P["query"] : never };
  /** Restrict cleanup to a single user. Omit for global cleanup. */
  userId?: string;
}

async function revokeStaleSessionsInternal(opts: CleanupOptions = {}): Promise<number> {
  const db   = opts.client ?? getPool();
  const uid  = opts.userId ?? null;

  // Shared filter fragment: if uid is null, no user filter is applied.
  const userFilter = uid !== null ? "AND user_id = $2" : "";

  async function revoke(
    reason: "timeout" | "expired",
    whereExtra: string,
    params: unknown[],
    detail?: string,
  ) {
    const { rows } = await (db as ReturnType<typeof getPool>).query(
      `UPDATE user_sessions
       SET revoked_at = now(), revoke_reason = $1
       WHERE revoked_at IS NULL
         ${userFilter}
         ${whereExtra}
       RETURNING
         id, user_id, username, active_role, window_id`,
      [reason, ...(uid !== null ? [uid] : []), ...params],
    );

    for (const s of rows) {
      await logAudit({
        action:   "auth.session_revoked",
        userId:   s.user_id,
        username: s.username,
        role:     s.active_role,
        windowId: s.window_id,
        details:  { sessionId: s.id, reason, auto: true, ...(detail ? { detail } : {}) },
      });
    }
    return rows.length;
  }

  const paramOffset = uid !== null ? 2 : 1; // $1 is reason; $2 is uid (if present)

  // Idle sessions
  const idleCount = await revoke(
    "timeout",
    `AND last_activity_at <= now() - (interval '1 second' * $${paramOffset})`,
    [SESSION_IDLE_TIMEOUT_SECONDS],
  );

  // Hard-expired sessions
  const expiredCount = await revoke(
    "expired",
    `AND expires_at <= now()`,
    [],
  );

  // Zero-tab sessions that have also been idle for the timeout period
  const closedCount = await revoke(
    "timeout",
    `AND tab_count <= 0 AND last_activity_at <= now() - (interval '1 second' * $${paramOffset})`,
    [SESSION_IDLE_TIMEOUT_SECONDS],
    "closed tabs",
  );

  return idleCount + expiredCount + closedCount;
}

// ─── Public session operations ────────────────────────────────────────────────

export interface CreateSessionParams {
  userId: string;
  username: string;
  activeRole: UserRole;
  windowId: number | null;
  jobTitleId?: string | null;
  maxSessions: number;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  ipAddress?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  deviceVendor?: string | null;
  deviceModel?: string | null;
  browserName?: string | null;
  browserVersion?: string | null;
}

/**
 * Creates a new session inside a serialisable transaction that:
 *   1. Row-locks the user to prevent concurrent login races.
 *   2. Cleans up stale sessions for that user.
 *   3. Enforces the maxSessions cap.
 *   4. Inserts the new session row and commits.
 *
 * This is the ONLY public session-creation function. The old non-atomic
 * `createUserSession` has been removed because it silently bypassed the cap.
 */
export async function createUserSessionAtomic(
  params: CreateSessionParams,
): Promise<{ token: string; session: SessionRecord } | { error: "MAX_SESSIONS_REACHED" }> {
  const pool   = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialise concurrent logins for the same user.
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [params.userId]);

    // Clean up stale sessions inside the same transaction.
    await revokeStaleSessionsInternal({ client: client as any, userId: params.userId });

    // Enforce session cap.
    const { rows: countRows } = await client.query<{ count: string }>(
      `SELECT count(*) AS count
       FROM user_sessions
       WHERE user_id    = $1
         AND revoked_at IS NULL
         AND expires_at > now()`,
      [params.userId],
    );
    if (parseInt(countRows[0].count, 10) >= params.maxSessions) {
      await client.query("ROLLBACK");
      return { error: "MAX_SESSIONS_REACHED" };
    }

    const token    = generateSessionToken();
    const hash     = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    const geo = params.ipAddress
      ? await getGeolocation(params.ipAddress)
      : { country: null, countryCode: null, city: null, region: null };

    const { rows } = await client.query<DbSessionRow>(
      `INSERT INTO user_sessions (
        user_id, username, active_role, window_id, job_title_id,
        token_hash, device, browser, os, ip_address,
        os_name, os_version, device_vendor, device_model, browser_name, browser_version,
        tab_count,
        country, country_code, city, region,
        created_at, last_activity_at, expires_at
      ) VALUES (
        $1,  $2,  $3,  $4,  $5,
        $6,  $7,  $8,  $9,  $10,
        $11, $12, $13, $14, $15, $16,
        0,
        $17, $18, $19, $20,
        now(), now(), $21
      )
      RETURNING
        id, user_id, username, active_role, window_id, job_title_id,
        token_hash, device, browser, os, ip_address,
        os_name, os_version, device_vendor, device_model, browser_name, browser_version,
        tab_count, country, country_code, city, region,
        created_at, last_activity_at, expires_at, revoked_at, revoke_reason`,
      [
        params.userId,         params.username,        params.activeRole,
        params.windowId ?? null, params.jobTitleId ?? null,
        hash,
        params.device        ?? null, params.browser       ?? null,
        params.os            ?? null, params.ipAddress     ?? null,
        params.osName        ?? null, params.osVersion     ?? null,
        params.deviceVendor  ?? null, params.deviceModel   ?? null,
        params.browserName   ?? null, params.browserVersion ?? null,
        geo.country, geo.countryCode, geo.city, geo.region,
        expiresAt.toISOString(),
      ],
    );

    const session = mapRow(rows[0]);

    await logAudit({
      action:   "auth.session_created",
      userId:   session.userId,
      username: session.username,
      role:     session.activeRole,
      windowId: session.windowId,
      details:  {
        sessionId: session.id,
        device:    session.device,
        browser:   session.browser,
        os:        session.os,
        ipAddress: session.ipAddress,
        expiresAt: session.expiresAt.toISOString(),
      },
    });

    await client.query("COMMIT");
    return { token, session };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Counts active sessions for a user, cleaning up stale ones first.
 * Runs outside a transaction — suitable for read/display purposes.
 * Use createUserSessionAtomic (which enforces the cap atomically) for
 * login flows.
 */
export async function countActiveSessionsForUser(userId: string): Promise<number> {
  await revokeStaleSessionsInternal({ userId });

  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) AS count
     FROM user_sessions
     WHERE user_id    = $1
       AND revoked_at IS NULL
       AND expires_at > now()`,
    [userId],
  );
  return parseInt(rows[0].count, 10);
}

export async function revokeSessionsForUser(
  userId: string,
  reason: SessionRevokeReason = "conflict",
  exceptSessionId?: string,
): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<DbSessionRow>(
    `UPDATE user_sessions
     SET revoked_at = now(), revoke_reason = $2
     WHERE user_id    = $1
       AND revoked_at IS NULL
       AND ($3::uuid IS NULL OR id <> $3::uuid)
     RETURNING id, user_id, username, active_role, window_id`,
    [userId, reason, exceptSessionId ?? null],
  );

  for (const s of rows) {
    await logAudit({
      action:   "auth.session_revoked",
      userId:   s.user_id,
      username: s.username,
      role:     s.active_role,
      windowId: s.window_id,
      details:  { sessionId: s.id, reason, auto: true },
    });
  }
}

export async function revokeSessionById(
  sessionId: string,
  reason: SessionRevokeReason = "logout",
): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<DbSessionRow>(
    `UPDATE user_sessions
     SET revoked_at = now(), revoke_reason = $2
     WHERE id = $1 AND revoked_at IS NULL
     RETURNING id, user_id, username, active_role, window_id`,
    [sessionId, reason],
  );

  if (rows.length > 0) {
    const s = rows[0];
    await logAudit({
      action:   "auth.session_revoked",
      userId:   s.user_id,
      username: s.username,
      role:     s.active_role,
      windowId: s.window_id,
      details:  { sessionId: s.id, reason, auto: reason !== "logout" },
    });
  }
}

export async function revokeSessionByToken(
  token: string,
  reason: SessionRevokeReason = "logout",
): Promise<void> {
  const hash = hashToken(token);
  const pool = getPool();
  const { rows } = await pool.query<DbSessionRow>(
    `UPDATE user_sessions
     SET revoked_at = now(), revoke_reason = $2
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id, user_id, username, active_role, window_id`,
    [hash, reason],
  );

  if (rows.length > 0) {
    const s = rows[0];
    await logAudit({
      action:   "auth.session_revoked",
      userId:   s.user_id,
      username: s.username,
      role:     s.active_role,
      windowId: s.window_id,
      details:  { sessionId: s.id, reason, auto: reason !== "logout" },
    });
  }
}

/** Looks up a session by its raw token. Returns all columns including geo and tab_count. */
export async function findSessionByToken(token: string): Promise<SessionRecord | null> {
  const hash = hashToken(token);
  const pool = getPool();
  const { rows } = await pool.query<DbSessionRow>(
    `SELECT
       id, user_id, username, active_role, window_id, job_title_id,
       token_hash, device, browser, os, ip_address, tab_count,
       os_name, os_version, device_vendor, device_model, browser_name, browser_version,
       created_at, last_activity_at, expires_at, revoked_at, revoke_reason,
       country, country_code, city, region
     FROM user_sessions
     WHERE token_hash = $1
     LIMIT 1`,
    [hash],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function touchSession(
  sessionId: string,
  timestamp = new Date(),
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE user_sessions SET last_activity_at = $2 WHERE id = $1`,
    [sessionId, timestamp.toISOString()],
  );
}

export async function incrementTabCount(sessionId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE user_sessions
     SET tab_count = tab_count + 1, last_activity_at = now()
     WHERE id = $1`,
    [sessionId],
  );
}

export async function decrementTabCount(sessionId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE user_sessions
     SET tab_count = GREATEST(0, tab_count - 1), last_activity_at = now()
     WHERE id = $1`,
    [sessionId],
  );
}

/** Revokes all stale sessions across every user. Returns the total number revoked. */
export async function cleanupAllStaleSessions(): Promise<number> {
  return revokeStaleSessionsInternal(); // no userId → global sweep
}

export async function listSessions(now = Date.now()): Promise<SessionSummary[]> {
  const pool = getPool();
  const { rows } = await pool.query<
    DbSessionRow & { full_name: string | null; job_title_english: string | null; job_title_amharic: string | null }
  >(
    `SELECT
       us.id, us.user_id, us.username, us.active_role, us.window_id, us.job_title_id,
       us.token_hash, us.device, us.browser, us.os, us.ip_address, us.tab_count,
       us.os_name, us.os_version, us.device_vendor, us.device_model,
       us.browser_name, us.browser_version,
       us.created_at, us.last_activity_at, us.expires_at,
       us.revoked_at, us.revoke_reason,
       us.country, us.country_code, us.city, us.region,
       u.full_name,
       jt.name_english  AS job_title_english,
       jt.name_amharic  AS job_title_amharic
     FROM user_sessions us
     LEFT JOIN users     u  ON us.user_id     = u.id
     LEFT JOIN job_title jt ON us.job_title_id = jt.id
     ORDER BY us.last_activity_at DESC`,
  );

  return rows.map((row) => {
    const session  = mapRow(row);
    const jobTitle = row.job_title_english ?? row.job_title_amharic ?? null;
    return toSummary(session, row.full_name, jobTitle, now);
  });
}
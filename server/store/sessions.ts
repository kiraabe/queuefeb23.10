import { createHash, randomBytes } from "node:crypto";
import type { SessionSummary, UserRole } from "../../shared/api";
import { getPool, logAudit } from "./db";

export const SESSION_COOKIE = process.env.AUTH_COOKIE_NAME || "queue_session";

function parseNumberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const SESSION_IDLE_TIMEOUT_SECONDS = parseNumberEnv(
  process.env.SESSION_IDLE_TIMEOUT_SECONDS,
  30 * 60, // 30 minutes - reduced from 4 hours as per requirements
);

// How many seconds of inactivity makes a teller considered unavailable for transfers.
// Can be configured via TRANSFER_AVAILABILITY_CHECK_SECONDS env var. Falls back to SESSION_IDLE_TIMEOUT_SECONDS.
export const TRANSFER_AVAILABILITY_CHECK_SECONDS = parseNumberEnv(
  process.env.TRANSFER_AVAILABILITY_CHECK_SECONDS,
  SESSION_IDLE_TIMEOUT_SECONDS,
);
export const SESSION_MAX_AGE_SECONDS = parseNumberEnv(
  process.env.SESSION_TTL_SECONDS,
  24 * 60 * 60, // 24 hours - increased from 8 hours for longer session duration
);

export async function createUserSessionAtomic(params: {
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
}): Promise<
  { token: string; session: SessionRecord } | { error: "MAX_SESSIONS_REACHED" }
> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Lock the user row to prevent concurrent logins for the same user
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
      params.userId,
    ]);

    // Clean up idle sessions for this user
    const idleRes = await client.query(
      `UPDATE user_sessions
       SET revoked_at = now(), revoke_reason = 'timeout'
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND last_activity_at <= now() - (interval '1 second' * $2)
       RETURNING *`,
      [params.userId, SESSION_IDLE_TIMEOUT_SECONDS],
    );

    for (const s of idleRes.rows) {
      await logAudit({
        action: "auth.session_revoked",
        userId: s.user_id,
        username: s.username,
        role: s.active_role,
        windowId: s.window_id,
        details: { sessionId: s.id, reason: "timeout", auto: true },
      });
    }

    // Clean up expired sessions for this user
    const expiredRes = await client.query(
      `UPDATE user_sessions
       SET revoked_at = now(), revoke_reason = 'expired'
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND expires_at <= now()
       RETURNING *`,
      [params.userId],
    );

    for (const s of expiredRes.rows) {
      await logAudit({
        action: "auth.session_revoked",
        userId: s.user_id,
        username: s.username,
        role: s.active_role,
        windowId: s.window_id,
        details: { sessionId: s.id, reason: "expired", auto: true },
      });
    }

    // Count active sessions
    const { rows: countRows } = await client.query(
      `SELECT count(*) as count
       FROM user_sessions
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND expires_at > now()`,
      [params.userId],
    );
    const activeCount = parseInt(countRows[0].count, 10);

    if (activeCount >= params.maxSessions) {
      await client.query("ROLLBACK");
      return { error: "MAX_SESSIONS_REACHED" };
    }

    const token = generateSessionToken();
    const hash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    const { rows } = await client.query(
      `INSERT INTO user_sessions (
        user_id,
        username,
        active_role,
        window_id,
        job_title_id,
        token_hash,
        device,
        browser,
        os,
        ip_address,
        os_name,
        os_version,
        device_vendor,
        device_model,
        browser_name,
        browser_version,
        created_at,
        last_activity_at,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now(), $17)
      RETURNING id, user_id, username, active_role, window_id, job_title_id, token_hash, device, browser, os, ip_address, os_name, os_version, device_vendor, device_model, browser_name, browser_version, created_at, last_activity_at, expires_at, revoked_at, revoke_reason`,
      [
        params.userId,
        params.username,
        params.activeRole,
        params.windowId ?? null,
        params.jobTitleId ?? null,
        hash,
        params.device ?? null,
        params.browser ?? null,
        params.os ?? null,
        params.ipAddress ?? null,
        params.osName ?? null,
        params.osVersion ?? null,
        params.deviceVendor ?? null,
        params.deviceModel ?? null,
        params.browserName ?? null,
        params.browserVersion ?? null,
        expiresAt.toISOString(),
      ],
    );
    const session = mapRow(rows[0]);

    await client.query("COMMIT");
    return { token, session };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

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
  osName: string | null;
  osVersion: string | null;
  deviceVendor: string | null;
  deviceModel: string | null;
  browserName: string | null;
  browserVersion: string | null;
  revokedAt: Date | null;
  revokeReason: SessionRevokeReason | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mapRow(row: any): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    activeRole: row.active_role,
    windowId: row.window_id ?? null,
    jobTitleId: row.job_title_id ?? null,
    tokenHash: row.token_hash,
    createdAt: new Date(row.created_at),
    lastActivityAt: new Date(row.last_activity_at),
    expiresAt: new Date(row.expires_at),
    device: row.device ?? null,
    browser: row.browser ?? null,
    os: row.os ?? null,
    ipAddress: row.ip_address ?? null,
    osName: row.os_name ?? null,
    osVersion: row.os_version ?? null,
    deviceVendor: row.device_vendor ?? null,
    deviceModel: row.device_model ?? null,
    browserName: row.browser_name ?? null,
    browserVersion: row.browser_version ?? null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    revokeReason: (row.revoke_reason as SessionRevokeReason | null) ?? null,
  };
}

function toSummary(
  session: SessionRecord,
  fullName?: string | null,
  jobTitle?: string | null,
  now = Date.now(),
): SessionSummary {
  const expired = now > session.expiresAt.getTime();
  const status = session.revokedAt ? "revoked" : expired ? "expired" : "active";
  return {
    id: session.id,
    username: session.username,
    role: session.activeRole,
    windowId: session.windowId,
    createdAt: session.createdAt.getTime(),
    lastSeenAt: session.lastActivityAt.getTime(),
    expiresAt: session.expiresAt.getTime(),
    status,
    device: session.device,
    browser: session.browser,
    os: session.os,
    ipAddress: session.ipAddress,
    osName: session.osName,
    osVersion: session.osVersion,
    deviceVendor: session.deviceVendor,
    deviceModel: session.deviceModel,
    browserName: session.browserName,
    browserVersion: session.browserVersion,
    revokeReason: session.revokeReason ?? null,
    fullName: fullName ?? null,
    jobTitle: jobTitle ?? null,
  };
}

export function generateSessionToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

export async function createUserSession(params: {
  userId: string;
  username: string;
  activeRole: UserRole;
  windowId: number | null;
  jobTitleId?: string | null;
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
}): Promise<{ token: string; session: SessionRecord }> {
  const token = generateSessionToken();
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const p = getPool();
  const { rows } = await p.query(
    `INSERT INTO user_sessions (
      user_id,
      username,
      active_role,
      window_id,
      job_title_id,
      token_hash,
      device,
      browser,
      os,
      ip_address,
      os_name,
      os_version,
      device_vendor,
      device_model,
      browser_name,
      browser_version,
      created_at,
      last_activity_at,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now(), $17)
    RETURNING id, user_id, username, active_role, window_id, job_title_id, token_hash, device, browser, os, ip_address, os_name, os_version, device_vendor, device_model, browser_name, browser_version, created_at, last_activity_at, expires_at, revoked_at, revoke_reason`,
    [
      params.userId,
      params.username,
      params.activeRole,
      params.windowId ?? null,
      params.jobTitleId ?? null,
      hash,
      params.device ?? null,
      params.browser ?? null,
      params.os ?? null,
      params.ipAddress ?? null,
      params.osName ?? null,
      params.osVersion ?? null,
      params.deviceVendor ?? null,
      params.deviceModel ?? null,
      params.browserName ?? null,
      params.browserVersion ?? null,
      expiresAt.toISOString(),
    ],
  );
  const session = mapRow(rows[0]);
  return { token, session };
}

export async function countActiveSessionsForUser(
  userId: string,
): Promise<number> {
  const p = getPool();

  // Clean up idle sessions for this user
  const idleRes = await p.query(
    `UPDATE user_sessions
     SET revoked_at = now(), revoke_reason = 'timeout'
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND last_activity_at <= now() - (interval '1 second' * $2)
     RETURNING *`,
    [userId, SESSION_IDLE_TIMEOUT_SECONDS],
  );

  for (const s of idleRes.rows) {
    await logAudit({
      action: "auth.session_revoked",
      userId: s.user_id,
      username: s.username,
      role: s.active_role,
      windowId: s.window_id,
      details: { sessionId: s.id, reason: "timeout", auto: true },
    });
  }

  // Clean up expired sessions for this user
  const expiredRes = await p.query(
    `UPDATE user_sessions
     SET revoked_at = now(), revoke_reason = 'expired'
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND expires_at <= now()
     RETURNING *`,
    [userId],
  );

  for (const s of expiredRes.rows) {
    await logAudit({
      action: "auth.session_revoked",
      userId: s.user_id,
      username: s.username,
      role: s.active_role,
      windowId: s.window_id,
      details: { sessionId: s.id, reason: "expired", auto: true },
    });
  }

  // Now count truly active sessions
  const { rows } = await p.query(
    `SELECT count(*) as count
     FROM user_sessions
     WHERE user_id = $1
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
) {
  const p = getPool();
  const { rows } = await p.query(
    `UPDATE user_sessions
     SET revoked_at = now(), revoke_reason = $2
     WHERE user_id = $1 AND (revoked_at IS NULL) AND ($3::uuid IS NULL OR id <> $3::uuid)
     RETURNING *`,
    [userId, reason, exceptSessionId ?? null],
  );

  for (const s of rows) {
    await logAudit({
      action: "auth.session_revoked",
      userId: s.user_id,
      username: s.username,
      role: s.active_role,
      windowId: s.window_id,
      details: { sessionId: s.id, reason, auto: true },
    });
  }
}

export async function revokeSessionById(
  sessionId: string,
  reason: SessionRevokeReason = "logout",
) {
  const p = getPool();
  const { rows } = await p.query(
    `UPDATE user_sessions SET revoked_at = now(), revoke_reason = $2 WHERE id = $1 AND revoked_at IS NULL RETURNING *`,
    [sessionId, reason],
  );

  if (rows.length > 0) {
    const s = rows[0];
    await logAudit({
      action: "auth.session_revoked",
      userId: s.user_id,
      username: s.username,
      role: s.active_role,
      windowId: s.window_id,
      details: { sessionId: s.id, reason, auto: reason !== "logout" },
    });
  }
}

export async function revokeSessionByToken(
  token: string,
  reason: SessionRevokeReason = "logout",
) {
  const hash = hashToken(token);
  const p = getPool();
  const { rows } = await p.query(
    `UPDATE user_sessions SET revoked_at = now(), revoke_reason = $2 WHERE token_hash = $1 AND revoked_at IS NULL RETURNING *`,
    [hash, reason],
  );

  if (rows.length > 0) {
    const s = rows[0];
    await logAudit({
      action: "auth.session_revoked",
      userId: s.user_id,
      username: s.username,
      role: s.active_role,
      windowId: s.window_id,
      details: { sessionId: s.id, reason, auto: reason !== "logout" },
    });
  }
}

export async function findSessionByToken(token: string) {
  const hash = hashToken(token);
  const p = getPool();
  const { rows } = await p.query(
    `SELECT id, user_id, username, active_role, window_id, job_title_id, token_hash, device, browser, os, ip_address, os_name, os_version, device_vendor, device_model, browser_name, browser_version, created_at, last_activity_at, expires_at, revoked_at, revoke_reason
     FROM user_sessions
     WHERE token_hash = $1
     LIMIT 1`,
    [hash],
  );
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function touchSession(sessionId: string, timestamp = new Date()) {
  const p = getPool();
  await p.query(`UPDATE user_sessions SET last_activity_at = $2 WHERE id = $1`, [
    sessionId,
    timestamp.toISOString(),
  ]);
}

export function sessionExpired(
  session: SessionRecord,
  now = new Date(),
): boolean {
  if (session.revokedAt) return true;
  if (now.getTime() > session.expiresAt.getTime()) return true;
  if (
    now.getTime() - session.lastActivityAt.getTime() >
    SESSION_IDLE_TIMEOUT_SECONDS * 1000
  )
    return true;
  return false;
}

export async function cleanupAllStaleSessions(): Promise<number> {
  const p = getPool();

  // Revoke idle sessions across all users
  const idleResult = await p.query(
    `UPDATE user_sessions
     SET revoked_at = now(), revoke_reason = 'timeout'
     WHERE revoked_at IS NULL
       AND last_activity_at <= now() - (interval '1 second' * $1)
     RETURNING *`,
    [SESSION_IDLE_TIMEOUT_SECONDS],
  );

  for (const s of idleResult.rows) {
    await logAudit({
      action: "auth.session_revoked",
      userId: s.user_id,
      username: s.username,
      role: s.active_role,
      windowId: s.window_id,
      details: { sessionId: s.id, reason: "timeout", auto: true },
    });
  }

  // Revoke expired sessions across all users
  const expiredResult = await p.query(
    `UPDATE user_sessions
     SET revoked_at = now(), revoke_reason = 'expired'
     WHERE revoked_at IS NULL
       AND expires_at <= now()
     RETURNING *`,
  );

  for (const s of expiredResult.rows) {
    await logAudit({
      action: "auth.session_revoked",
      userId: s.user_id,
      username: s.username,
      role: s.active_role,
      windowId: s.window_id,
      details: { sessionId: s.id, reason: "expired", auto: true },
    });
  }

  const totalRevoked =
    (idleResult.rowCount || 0) + (expiredResult.rowCount || 0);
  return totalRevoked;
}

export async function listSessions(
  now = Date.now(),
): Promise<SessionSummary[]> {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT
      us.id, us.user_id, us.username, us.active_role, us.window_id, us.job_title_id,
      us.token_hash, us.device, us.browser, us.os, us.ip_address,
      us.os_name, us.os_version, us.device_vendor, us.device_model, us.browser_name, us.browser_version,
      us.created_at, us.last_activity_at, us.expires_at, us.revoked_at, us.revoke_reason,
      u.full_name,
      jt.name_english as job_title_english,
      jt.name_amharic as job_title_amharic
     FROM user_sessions us
     LEFT JOIN users u ON us.user_id = u.id
     LEFT JOIN job_title jt ON us.job_title_id = jt.id
     ORDER BY us.last_activity_at DESC`,
  );
  return rows.map((row) => {
    const sessionRecord = mapRow({
      ...row,
      user_id: row.user_id,
      username: row.username,
      active_role: row.active_role,
      window_id: row.window_id,
      job_title_id: row.job_title_id,
      token_hash: row.token_hash,
      device: row.device,
      browser: row.browser,
      os: row.os,
      ip_address: row.ip_address,
      os_name: row.os_name,
      os_version: row.os_version,
      device_vendor: row.device_vendor,
      device_model: row.device_model,
      browser_name: row.browser_name,
      browser_version: row.browser_version,
      created_at: row.created_at,
      last_activity_at: row.last_activity_at,
      expires_at: row.expires_at,
      revoked_at: row.revoked_at,
      revoke_reason: row.revoke_reason,
      id: row.id,
    });
    // Use English job title, fallback to Amharic if English is not available
    const jobTitle = row.job_title_english || row.job_title_amharic || null;
    return toSummary(sessionRecord, row.full_name, jobTitle, now);
  });
}

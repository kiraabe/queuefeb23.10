import { createHash, randomBytes } from "node:crypto";
import type { SessionSummary, UserRole } from "../../shared/api";
import { getPool } from "./db";

export const SESSION_COOKIE = process.env.AUTH_COOKIE_NAME || "queue_session";

function parseNumberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const SESSION_IDLE_TIMEOUT_SECONDS = parseNumberEnv(
  process.env.SESSION_IDLE_TIMEOUT_SECONDS,
  30 * 60,
);

// How many seconds of inactivity makes a teller considered unavailable for transfers.
// Can be configured via TRANSFER_AVAILABILITY_CHECK_SECONDS env var. Falls back to SESSION_IDLE_TIMEOUT_SECONDS.
export const TRANSFER_AVAILABILITY_CHECK_SECONDS = parseNumberEnv(
  process.env.TRANSFER_AVAILABILITY_CHECK_SECONDS,
  SESSION_IDLE_TIMEOUT_SECONDS,
);
export const SESSION_MAX_AGE_SECONDS = parseNumberEnv(
  process.env.SESSION_TTL_SECONDS,
  8 * 60 * 60,
);

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
  lastSeenAt: Date;
  expiresAt: Date;
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
    lastSeenAt: new Date(row.last_seen_at),
    expiresAt: new Date(row.expires_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    revokeReason: (row.revoke_reason as SessionRevokeReason | null) ?? null,
  };
}

function toSummary(session: SessionRecord, now = Date.now()): SessionSummary {
  const expired = now > session.expiresAt.getTime();
  const status = session.revokedAt ? "revoked" : expired ? "expired" : "active";
  return {
    id: session.id,
    username: session.username,
    role: session.activeRole,
    windowId: session.windowId,
    createdAt: session.createdAt.getTime(),
    lastSeenAt: session.lastSeenAt.getTime(),
    expiresAt: session.expiresAt.getTime(),
    status,
    revokeReason: session.revokeReason ?? null,
  };
}

export function generateSessionToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

export async function createUserSession(params: {
  userId: string;
  username: string;
  role: UserRole;
  windowId: number | null;
  jobTitleId?: string | null;
}): Promise<{ token: string; session: SessionRecord }> {
  const token = generateSessionToken();
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const p = getPool();
  const { rows } = await p.query(
    `INSERT INTO user_sessions (
      user_id,
      username,
      role,
      window_id,
      job_title_id,
      token_hash,
      created_at,
      last_seen_at,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, now(), now(), $7)
    RETURNING id, user_id, username, role, window_id, job_title_id, token_hash, created_at, last_seen_at, expires_at, revoked_at, revoke_reason`,
    [
      params.userId,
      params.username,
      params.role,
      params.windowId ?? null,
      params.jobTitleId ?? null,
      hash,
      expiresAt.toISOString(),
    ],
  );
  const session = mapRow(rows[0]);
  return { token, session };
}

export async function revokeSessionsForUser(
  userId: string,
  reason: SessionRevokeReason = "conflict",
  exceptSessionId?: string,
) {
  const p = getPool();
  await p.query(
    `UPDATE user_sessions
     SET revoked_at = now(), revoke_reason = $2
     WHERE user_id = $1 AND (revoked_at IS NULL) AND ($3::uuid IS NULL OR id <> $3::uuid)`,
    [userId, reason, exceptSessionId ?? null],
  );
}

export async function revokeSessionById(
  sessionId: string,
  reason: SessionRevokeReason = "logout",
) {
  const p = getPool();
  await p.query(
    `UPDATE user_sessions SET revoked_at = now(), revoke_reason = $2 WHERE id = $1`,
    [sessionId, reason],
  );
}

export async function revokeSessionByToken(
  token: string,
  reason: SessionRevokeReason = "logout",
) {
  const hash = hashToken(token);
  const p = getPool();
  await p.query(
    `UPDATE user_sessions SET revoked_at = now(), revoke_reason = $2 WHERE token_hash = $1`,
    [hash, reason],
  );
}

export async function findSessionByToken(token: string) {
  const hash = hashToken(token);
  const p = getPool();
  const { rows } = await p.query(
    `SELECT id, user_id, username, role, window_id, job_title_id, token_hash, created_at, last_seen_at, expires_at, revoked_at, revoke_reason
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
  await p.query(`UPDATE user_sessions SET last_seen_at = $2 WHERE id = $1`, [
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
    now.getTime() - session.lastSeenAt.getTime() >
    SESSION_IDLE_TIMEOUT_SECONDS * 1000
  )
    return true;
  return false;
}

export async function listSessions(
  now = Date.now(),
): Promise<SessionSummary[]> {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT id, user_id, username, role, window_id, job_title_id, token_hash, created_at, last_seen_at, expires_at, revoked_at, revoke_reason
     FROM user_sessions
     ORDER BY last_seen_at DESC`,
  );
  return rows.map((row) => toSummary(mapRow(row), now));
}

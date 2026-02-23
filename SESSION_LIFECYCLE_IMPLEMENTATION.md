# Session Lifecycle Management Implementation

## Overview
This document describes the comprehensive session lifecycle management system implemented to fix concurrent login session tracking, prevent stale sessions, and enforce session limits.

## Key Improvements

### 1. Session Expiration & Activity Tracking

**Fields Added to `user_sessions` Table:**
- `last_activity_at TIMESTAMPTZ` - Updated on every authenticated request and heartbeat
- `expires_at TIMESTAMPTZ` - Set when session is created (24 hours TTL)
- `revoked_at TIMESTAMPTZ` - Set when session is manually revoked
- `revoke_reason TEXT` - Reason for revocation (logout, timeout, expired, conflict, invalidated)

**Automatic Activity Updates:**
- Every authenticated API request touches the session (updates `last_activity_at`)
- Frontend sends heartbeat every 60 seconds to keep session alive
- Sessions cannot survive more than 30 minutes of inactivity
- Sessions expire after 24 hours regardless of activity

### 2. Scheduled Background Cleanup Job

**Implementation:**
```typescript
// Runs on server startup
cleanupAllStaleSessions()

// Runs every 5 minutes
setInterval(cleanupAllStaleSessions, 5 * 60 * 1000)
```

**Cleanup Performs:**
1. Revokes all sessions with `last_activity_at ≤ now() - 30 minutes`
2. Revokes all sessions with `expires_at ≤ now()`
3. Logs audit entry for each cleanup action
4. Returns count of cleaned sessions

### 3. Concurrent Session Management

**Enforcement Logic:**
- Maximum 3 active sessions per user (configurable via `MAX_SESSIONS_PER_USER` env)
- Sessions are counted only if:
  - `revoked_at IS NULL` (not revoked)
  - `expires_at > now()` (not expired)
- Expired and idle sessions are cleaned before counting

**Atomic Session Creation:**
```typescript
1. BEGIN TRANSACTION
2. Lock user row with SELECT ... FOR UPDATE
3. Revoke idle sessions (last_activity_at too old)
4. Revoke expired sessions (expires_at in past)
5. Count remaining active sessions
6. If under limit: INSERT new session
7. Else: ROLLBACK and return MAX_SESSIONS_REACHED
8. COMMIT
```

This prevents race conditions during concurrent login attempts.

### 4. Frontend Heartbeat Mechanism

**Implementation in `client/hooks/use-auth.tsx`:**
- Sends heartbeat every 60 seconds when user is authenticated
- Only sends heartbeat when tab is visible (respects `visibilityState`)
- Prevents multiple concurrent heartbeats
- On 401 response, logs out the user
- Logs successful heartbeats in development mode

**Benefit:**
- Keeps session alive during active use
- Prevents premature session timeout
- Safe to skip heartbeats when tab is hidden (session expires after 30 min inactivity)

### 5. Automatic Session Touching

**Routes That Touch Sessions:**
- `/api/auth/me` - Via improved authentication flow
- `/api/auth/heartbeat` - Explicit heartbeat endpoint
- All routes using `requireRole(roles)` middleware
- All routes using `requireTellerForWindowParam(param)` middleware

**New Middleware:**
- `requireAuthentication()` - Generic authentication with automatic session touch

### 6. Comprehensive Audit Logging

**Audit Events:**
| Event | Action | Logged When |
|-------|--------|------------|
| Session Created | `auth.session_created` | New session created |
| Session Revoked | `auth.session_revoked` | Session expires/idles (auto) or manually revoked |
| Max Sessions Reached | `auth.max_sessions_reached` | Login rejected due to session limit |
| Role Switched | `auth.role_switched` | User switches to different role |
| Heartbeat Failed | `auth.heartbeat_failed` | Heartbeat fails (401 errors) |
| Login | `auth.login` | Successful login |
| Logout | `auth.logout` | Explicit logout |

**Audit Details Include:**
- User ID and username
- Active role
- Device information (device, browser, OS, IP address)
- Session ID
- Reason for revocation
- Time of action

### 7. Session Status Tracking

**Session Status Values:** `"active" | "revoked" | "expired"`

**Status Calculation:**
```typescript
const expired = now > session.expiresAt.getTime();
const status = session.revokedAt ? "revoked" : expired ? "expired" : "active";
```

**Returned in Session Summary:**
```typescript
interface SessionSummary {
  id: string;
  username: string;
  role: UserRole;
  status: "active" | "revoked" | "expired";
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  device?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  // ... additional device details
}
```

## Environment Variables

```env
# Session configuration
SESSION_IDLE_TIMEOUT_SECONDS=1800          # 30 minutes (when inactivity expires session)
SESSION_TTL_SECONDS=86400                   # 24 hours (max session duration)
MAX_SESSIONS_PER_USER=3                     # Maximum concurrent sessions per user

# Cookie configuration
AUTH_COOKIE_NAME=queue_session              # Session cookie name
COOKIE_SAMESITE=None                        # SameSite attribute (None, Lax, Strict)
COOKIE_SECURE=true                          # HTTPS only (auto-enabled if SameSite=None)

# 2FA (optional)
TWO_FACTOR_STATIC_CODE=                     # Static OTP code if 2FA enabled
```

## Session Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Login Attempt                                               │
├─────────────────────────────────────────────────────────────┤
│ 1. Validate credentials                                     │
│ 2. Count active sessions for user                          │
│ 3. If active count ≥ MAX_SESSIONS: reject (409)            │
│ 4. Create new session with:                                │
│    - created_at = now()                                    │
│    - last_activity_at = now()                              │
│    - expires_at = now() + 24 hours                         │
│ 5. Set cookie with Max-Age=86400 seconds                   │
│ 6. Return session token to client                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Active Session                                              │
├─────────────────────────────────────────────────────────────┤
│ • Every API request touches session (updates last_activity) │
│ • Heartbeat sent every 60 seconds                          │
│ • Session valid if:                                        │
│   - last_activity_at > now() - 30 minutes AND              │
│   - expires_at > now() AND                                 │
│   - revoked_at IS NULL                                     │
└─────────────────────────────────────────────────────────────┘
     ↓                    ↓                    ↓
  LOGOUT            INACTIVITY (30min)    EXPIRATION (24h)
     ↓                    ↓                    ↓
┌────────────────────────────────────────────────────────────┐
│ Session Revocation                                         │
├────────────────────────────────────────────────────────────┤
│ • Set revoked_at = now()                                  │
│ • Set revoke_reason = (logout/timeout/expired/conflict)  │
│ • Clear session cookie                                    │
│ • Log audit event                                         │
│ • Next request with this token returns 401                │
└────────────────────────────────────────────────────────────┘
```

## Race Condition Prevention

### Problem
Multiple concurrent login attempts could exceed MAX_SESSIONS limit if not handled atomically.

### Solution
`createUserSessionAtomic` uses database-level locking:

```sql
BEGIN TRANSACTION;

-- Lock user row to prevent concurrent modifications
SELECT id FROM users WHERE id = $1 FOR UPDATE;

-- Revoke stale sessions
UPDATE user_sessions SET revoked_at = now(), revoke_reason = 'timeout'
WHERE user_id = $1 AND revoked_at IS NULL 
  AND last_activity_at <= now() - interval '30 minutes';

UPDATE user_sessions SET revoked_at = now(), revoke_reason = 'expired'
WHERE user_id = $1 AND revoked_at IS NULL 
  AND expires_at <= now();

-- Count active sessions
SELECT count(*) FROM user_sessions 
WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now();

-- Only insert if under limit
INSERT INTO user_sessions (...) VALUES (...);

COMMIT;
```

This ensures:
- No race conditions during concurrent login attempts
- Session count is accurate at insertion time
- Stale sessions are cleaned before limit check
- All-or-nothing transaction (no partial updates)

## Testing

Comprehensive test suite available in `server/__tests__/session-lifecycle.test.ts`

**Test Coverage:**
- Session creation with proper expiration
- Concurrent session limits (3 max)
- Session cleanup (idle and expired)
- Session touching (activity updates)
- Session revocation by ID and token
- Global stale session cleanup
- Race condition prevention
- Session status tracking
- Device information preservation

**Run Tests:**
```bash
pnpm test session-lifecycle
```

## Migration Notes

### Database Changes
The required columns are automatically created on first startup via `initDb()`:
- `last_activity_at` (with default `now()`)
- `expires_at` (required for session expiration)
- `revoked_at` (nullable, set on revocation)
- `revoke_reason` (nullable, reason for revocation)

Existing sessions will get:
- `last_activity_at` = current time
- `expires_at` = current time + 24 hours
- `revoked_at` = NULL
- `revoke_reason` = NULL

### Backward Compatibility
- Session tokens continue to use SHA-256 hashing
- Cookie names and formats remain unchanged
- Login flow unchanged
- Error codes and messages maintained

## Monitoring & Operations

### Check Active Sessions
```bash
curl http://localhost:8080/api/admin/sessions \
  -H "Cookie: queue_session=<token>"
```

### Revoke Specific Session
```bash
curl -X DELETE http://localhost:8080/api/admin/sessions/<sessionId> \
  -H "Cookie: queue_session=<token>"
```

### Revoke All Other Sessions
```bash
curl -X POST http://localhost:8080/api/auth/revoke-all-sessions \
  -H "Cookie: queue_session=<token>"
```

### View Cleanup Status
Check server logs for cleanup messages:
```
[Sessions] Initial cleanup removed X stale sessions
[Sessions] Cleaned up Y stale sessions
```

## Performance Considerations

### Cleanup Frequency
- Runs every 5 minutes (configurable)
- Uses efficient bulk UPDATE statements
- Leverages indexes on `user_id` and `expires_at`
- Logs only revoked sessions (not every check)

### Database Indexes
Existing indexes support fast queries:
- `idx_user_sessions_token_hash` - Fast token lookup
- `idx_user_sessions_user_id` - Fast user session queries
- Consider adding: `idx_user_sessions_expires_at` for cleanup queries

### Frontend Performance
- Heartbeat only sent when tab is visible
- Prevents unnecessary requests in hidden tabs
- Safe to skip heartbeats (30 min timeout is generous)

## Security Considerations

### Session Security
- Tokens stored as SHA-256 hashes only (plaintext never stored)
- Tokens generated with 48 bytes of cryptographic randomness
- HttpOnly cookie prevents XSS token theft
- SameSite=None (with Secure) prevents CSRF on cross-origin requests

### Idle Timeout
- 30 minutes of inactivity expires session
- Prevents unauthorized access from unattended sessions
- Short enough for security, long enough for legitimate use

### Concurrent Session Limits
- Max 3 active sessions per user (configurable)
- Prevents account takeover from multiple compromised devices
- Automatic cleanup of idle sessions makes room for new logins

### Audit Trail
- All session lifecycle events logged
- Includes device/IP information for forensics
- Helps detect suspicious activity
- Supports compliance requirements

## Troubleshooting

### Sessions Still Showing as Active After Tab Close
**Cause:** Stale sessions not cleaned up yet (cleanup runs every 5 min)
**Solution:** Sessions will auto-revoke after 30 minutes of inactivity or 24-hour expiration

### "Maximum session limit reached" error
**Cause:** User has 3 active sessions already
**Solution:** 
- Logout from other devices
- Wait for inactive sessions to expire (30 min)
- Admin can revoke sessions via dashboard

### Heartbeat failing frequently
**Cause:** Session expiration or revocation
**Solution:** User should re-login to get new session

## Implementation Checklist

- [x] Add `last_activity_at` and `expires_at` fields
- [x] Add `revoked_at` and `revoke_reason` fields
- [x] Implement session touching on authenticated requests
- [x] Add frontend heartbeat (60-second interval)
- [x] Implement automatic idle session cleanup
- [x] Enforce concurrent session limits (3 max)
- [x] Add background cleanup job (5-minute interval)
- [x] Implement race condition prevention via atomic transactions
- [x] Add comprehensive audit logging
- [x] Create test suite for session lifecycle
- [x] Document environment variables
- [x] Update error messages for clarity
- [x] Add session status tracking
- [x] Implement device information tracking

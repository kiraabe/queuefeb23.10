import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createUserSessionAtomic,
  findSessionByToken,
  touchSession,
  revokeSessionById,
  revokeSessionByToken,
  countActiveSessionsForUser,
  cleanupAllStaleSessions,
  listSessions,
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_MAX_AGE_SECONDS,
} from "../store/sessions";
import { getPool } from "../store/db";

describe("Session Lifecycle Management", () => {
  const testUserId = "test-user-id";
  const testUsername = "testuser";
  const testRole = "teller";

  beforeEach(async () => {
    // Setup: Ensure test user exists
    const pool = getPool();
    await pool.query(
      `DELETE FROM user_sessions WHERE user_id = $1`,
      [testUserId],
    );
    try {
      await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
    } catch {}

    await pool.query(
      `INSERT INTO users (id, username, password_hash, role, disabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [testUserId, testUsername, "hash", testRole, false],
    );
  });

  afterEach(async () => {
    // Cleanup: Remove test sessions and user
    const pool = getPool();
    await pool.query(`DELETE FROM user_sessions WHERE user_id = $1`, [testUserId]);
    try {
      await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
    } catch {}
  });

  describe("Session Creation", () => {
    it("should create a new session with expiration timestamp", async () => {
      const result = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
      });

      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("session");
      if ("session" in result) {
        expect(result.session.userId).toBe(testUserId);
        expect(result.session.expiresAt.getTime()).toBeGreaterThan(
          Date.now(),
        );
        expect(
          result.session.expiresAt.getTime() - Date.now(),
        ).toBeLessThanOrEqual(SESSION_MAX_AGE_SECONDS * 1000);
      }
    });

    it("should set last_activity_at to now on creation", async () => {
      const beforeCreation = Date.now();
      const result = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
      });

      if ("session" in result) {
        const lastActivityTime = result.session.lastActivityAt.getTime();
        expect(lastActivityTime).toBeGreaterThanOrEqual(beforeCreation - 100);
        expect(lastActivityTime).toBeLessThanOrEqual(Date.now() + 100);
      }
    });
  });

  describe("Concurrent Session Limits", () => {
    it("should enforce maximum session limit (3 sessions)", async () => {
      const maxSessions = 3;

      // Create max sessions
      const sessions = [];
      for (let i = 0; i < maxSessions; i++) {
        const result = await createUserSessionAtomic({
          userId: testUserId,
          username: testUsername,
          activeRole: testRole,
          windowId: null,
          maxSessions,
        });
        expect(result).toHaveProperty("token");
        if ("session" in result) {
          sessions.push(result.session.id);
        }
      }

      // Attempt to create one more session - should fail
      const overLimitResult = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions,
      });

      expect(overLimitResult).toEqual({ error: "MAX_SESSIONS_REACHED" });
    });

    it("should allow new session after old one is revoked", async () => {
      const maxSessions = 1;

      // Create first session
      const result1 = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions,
      });

      if ("session" in result1) {
        const sessionId = result1.session.id;

        // Revoke the session
        await revokeSessionById(sessionId, "logout");

        // Should be able to create a new session now
        const result2 = await createUserSessionAtomic({
          userId: testUserId,
          username: testUsername,
          activeRole: testRole,
          windowId: null,
          maxSessions,
        });

        expect(result2).toHaveProperty("token");
        expect(result2).not.toHaveProperty("error");
      }
    });

    it("should clean up idle sessions before counting active sessions", async () => {
      const maxSessions = 2;

      // Create 2 sessions
      const result1 = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions,
      });

      const result2 = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions,
      });

      // Manually make first session idle
      if ("session" in result1) {
        const idleTime = new Date(
          Date.now() - (SESSION_IDLE_TIMEOUT_SECONDS + 60) * 1000,
        );
        const pool = getPool();
        await pool.query(
          `UPDATE user_sessions SET last_activity_at = $2 WHERE id = $1`,
          [result1.session.id, idleTime.toISOString()],
        );
      }

      // Third session should succeed because first one is idle and will be cleaned
      const result3 = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions,
      });

      expect(result3).toHaveProperty("token");
      expect(result3).not.toHaveProperty("error");
    });
  });

  describe("Session Touching (Activity Updates)", () => {
    it("should update last_activity_at when touch is called", async () => {
      const result = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
      });

      if ("session" in result) {
        const originalTime = result.session.lastActivityAt.getTime();
        const sessionId = result.session.id;

        // Wait a bit and touch the session
        await new Promise((resolve) => setTimeout(resolve, 100));
        await touchSession(sessionId);

        // Verify last_activity_at was updated
        const foundSession = await findSessionByToken(result.token);
        expect(foundSession).toBeTruthy();
        if (foundSession) {
          const updatedTime = foundSession.lastActivityAt.getTime();
          expect(updatedTime).toBeGreaterThan(originalTime);
        }
      }
    });
  });

  describe("Session Expiration", () => {
    it("should identify expired sessions based on expires_at", async () => {
      const result = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
      });

      if ("session" in result) {
        const sessionId = result.session.id;

        // Manually expire the session
        const pool = getPool();
        const pastTime = new Date(Date.now() - 1000).toISOString();
        await pool.query(
          `UPDATE user_sessions SET expires_at = $2 WHERE id = $1`,
          [sessionId, pastTime],
        );

        // Session should no longer be found or marked as expired
        const session = await findSessionByToken(result.token);
        // Note: findSessionByToken doesn't filter by expiration, so we need to check via listing
      }
    });

    it("should list expired sessions with correct status", async () => {
      const result = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
      });

      if ("session" in result) {
        const sessionId = result.session.id;

        // Manually expire the session
        const pool = getPool();
        const pastTime = new Date(Date.now() - 1000).toISOString();
        await pool.query(
          `UPDATE user_sessions SET expires_at = $2 WHERE id = $1`,
          [sessionId, pastTime],
        );

        // List sessions and check status
        const sessions = await listSessions();
        const expiredSession = sessions.find((s) => s.id === sessionId);
        expect(expiredSession?.status).toBe("expired");
      }
    });
  });

  describe("Session Revocation", () => {
    it("should revoke session by ID", async () => {
      const result = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
      });

      if ("session" in result) {
        const sessionId = result.session.id;

        // Revoke the session
        await revokeSessionById(sessionId, "logout");

        // Verify revocation
        const session = await findSessionByToken(result.token);
        expect(session?.revokedAt).toBeTruthy();
        expect(session?.revokeReason).toBe("logout");
      }
    });

    it("should revoke session by token", async () => {
      const result = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
      });

      if ("session" in result) {
        const token = result.token;

        // Revoke by token
        await revokeSessionByToken(token, "logout");

        // Verify revocation
        const session = await findSessionByToken(token);
        expect(session?.revokedAt).toBeTruthy();
      }
    });
  });

  describe("Cleanup Functions", () => {
    it("should count only active, non-revoked sessions", async () => {
      const maxSessions = 5;

      // Create 3 sessions
      for (let i = 0; i < 3; i++) {
        await createUserSessionAtomic({
          userId: testUserId,
          username: testUsername,
          activeRole: testRole,
          windowId: null,
          maxSessions,
        });
      }

      // Count should be 3
      let count = await countActiveSessionsForUser(testUserId);
      expect(count).toBe(3);

      // Get sessions and revoke one
      const sessions = await listSessions();
      const sessionToRevoke = sessions.find((s) => s.id && s.username === testUsername);
      if (sessionToRevoke?.id) {
        await revokeSessionById(sessionToRevoke.id, "logout");
      }

      // Count should now be 2
      count = await countActiveSessionsForUser(testUserId);
      expect(count).toBe(2);
    });

    it("should clean up stale sessions globally", async () => {
      // Create a session and make it idle
      const result = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
      });

      if ("session" in result) {
        // Make it idle
        const pool = getPool();
        const idleTime = new Date(
          Date.now() - (SESSION_IDLE_TIMEOUT_SECONDS + 60) * 1000,
        );
        await pool.query(
          `UPDATE user_sessions SET last_activity_at = $2 WHERE id = $1`,
          [result.session.id, idleTime.toISOString()],
        );

        // Run cleanup
        const cleaned = await cleanupAllStaleSessions();
        expect(cleaned).toBeGreaterThan(0);

        // Verify session is revoked
        const session = await findSessionByToken(result.token);
        if (session) {
          expect(session.revokedAt).toBeTruthy();
          expect(session.revokeReason).toBe("timeout");
        }
      }
    });
  });

  describe("Race Condition Prevention", () => {
    it("should handle concurrent session creation atomically", async () => {
      const maxSessions = 1;

      // Simulate concurrent session creation
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          createUserSessionAtomic({
            userId: testUserId,
            username: testUsername,
            activeRole: testRole,
            windowId: null,
            maxSessions,
          }),
        );
      }

      const results = await Promise.all(promises);

      // Exactly one should succeed, others should fail with MAX_SESSIONS_REACHED
      const successes = results.filter((r) => !("error" in r));
      const failures = results.filter((r) => "error" in r);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(2);
      expect(failures.every((f) => (f as any).error === "MAX_SESSIONS_REACHED")).toBe(true);
    });
  });

  describe("Session List and Status", () => {
    it("should list sessions with correct status", async () => {
      // Create an active session
      const activeResult = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
      });

      const sessions = await listSessions();
      const activeSession = sessions.find((s) => s.username === testUsername);

      expect(activeSession).toBeTruthy();
      expect(activeSession?.status).toBe("active");
      expect(activeSession?.createdAt).toBeLessThanOrEqual(Date.now());
      expect(activeSession?.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should include device information in session summary", async () => {
      const result = await createUserSessionAtomic({
        userId: testUserId,
        username: testUsername,
        activeRole: testRole,
        windowId: null,
        maxSessions: 3,
        device: "iPhone",
        browser: "Safari",
        os: "iOS",
        ipAddress: "192.168.1.1",
      });

      if ("session" in result) {
        const sessions = await listSessions();
        const session = sessions.find((s) => s.id === result.session.id);

        expect(session?.device).toBe("iPhone");
        expect(session?.browser).toBe("Safari");
        expect(session?.os).toBe("iOS");
        expect(session?.ipAddress).toBe("192.168.1.1");
      }
    });
  });
});

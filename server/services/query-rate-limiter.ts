import { DB_CONFIG } from "../store/db";

// Track active connections per user
const activeConnectionsPerUser = new Map<string, Set<string>>();

// Track query count per user per time window
const queryCountPerUser = new Map<string, { count: number; resetAt: number }>();

// Monitor long running queries
export interface QueryMetrics {
  userId: string;
  queryStartTime: number;
  queryText: string;
  duration: number;
  isSlowQuery: boolean;
}

const queryMetrics: QueryMetrics[] = [];
const MAX_METRICS_HISTORY = 1000;

/**
 * Check if a user is within their rate limit for queries
 * Returns: { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkQueryRateLimit(userId: string) {
  const now = Date.now();
  let userData = queryCountPerUser.get(userId);

  // Initialize or reset if window has passed
  if (!userData || now >= userData.resetAt) {
    userData = {
      count: 0,
      resetAt: now + DB_CONFIG.queryLimitWindowSeconds * 1000,
    };
    queryCountPerUser.set(userId, userData);
  }

  const allowed = userData.count < DB_CONFIG.maxQueriesPerUser;
  const remaining = Math.max(0, DB_CONFIG.maxQueriesPerUser - userData.count);
  const resetAt = userData.resetAt;

  if (allowed) {
    userData.count++;
  }

  return {
    allowed,
    remaining,
    resetAt,
    limit: DB_CONFIG.maxQueriesPerUser,
    windowSeconds: DB_CONFIG.queryLimitWindowSeconds,
  };
}

/**
 * Register a new database connection for a user
 */
export function registerConnection(userId: string, connectionId: string) {
  let userConnections = activeConnectionsPerUser.get(userId);
  if (!userConnections) {
    userConnections = new Set();
    activeConnectionsPerUser.set(userId, userConnections);
  }

  if (userConnections.size >= DB_CONFIG.maxConnectionsPerUser) {
    return {
      allowed: false,
      reason: `Exceeded maximum concurrent connections (${DB_CONFIG.maxConnectionsPerUser}) for user`,
    };
  }

  userConnections.add(connectionId);
  return { allowed: true };
}

/**
 * Unregister a database connection
 */
export function unregisterConnection(userId: string, connectionId: string) {
  const userConnections = activeConnectionsPerUser.get(userId);
  if (userConnections) {
    userConnections.delete(connectionId);
    if (userConnections.size === 0) {
      activeConnectionsPerUser.delete(userId);
    }
  }
}

/**
 * Get active connection count for a user
 */
export function getActiveConnectionsCount(userId: string): number {
  return activeConnectionsPerUser.get(userId)?.size ?? 0;
}

/**
 * Record a query execution for monitoring
 */
export function recordQueryMetric(metric: QueryMetrics) {
  queryMetrics.push(metric);

  // Keep history size manageable
  if (queryMetrics.length > MAX_METRICS_HISTORY) {
    queryMetrics.shift();
  }

  // Log slow queries
  if (metric.isSlowQuery) {
    console.warn(
      `[DB] Slow query detected (${metric.duration}ms) for user ${metric.userId}: ${metric.queryText.slice(0, 100)}...`
    );
  }
}

/**
 * Get query metrics for monitoring/debugging
 */
export function getQueryMetrics(userId?: string, limit: number = 100) {
  let metrics = queryMetrics;

  if (userId) {
    metrics = metrics.filter((m) => m.userId === userId);
  }

  return metrics.slice(-limit);
}

/**
 * Get rate limit status for all users
 */
export function getRateLimitStatus() {
  return {
    usersWithActiveLimits: queryCountPerUser.size,
    usersWithActiveConnections: activeConnectionsPerUser.size,
    limits: {
      maxQueriesPerUser: DB_CONFIG.maxQueriesPerUser,
      queryLimitWindowSeconds: DB_CONFIG.queryLimitWindowSeconds,
      maxConnectionsPerUser: DB_CONFIG.maxConnectionsPerUser,
    },
    users: Array.from(queryCountPerUser.entries()).map(([userId, data]) => ({
      userId,
      queryCount: data.count,
      maxQueryCount: DB_CONFIG.maxQueriesPerUser,
      activeConnections: getActiveConnectionsCount(userId),
      maxConnections: DB_CONFIG.maxConnectionsPerUser,
    })),
  };
}

/**
 * Reset rate limits for a specific user (admin only)
 */
export function resetUserRateLimit(userId: string) {
  queryCountPerUser.delete(userId);
  return { success: true, userId };
}

/**
 * Clear all rate limits (admin only, use with caution)
 */
export function clearAllRateLimits() {
  queryCountPerUser.clear();
  return { success: true, clearedUsers: queryCountPerUser.size };
}

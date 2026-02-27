import { Request, Response, NextFunction } from "express";
import { checkQueryRateLimit, getActiveConnectionsCount } from "../services/query-rate-limiter";

/**
 * Express middleware for database rate limiting
 * Checks query and connection limits for authenticated users
 */
export function dbRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract user ID from request (should be set by auth middleware)
  const userId = (req as any).userId;

  // Skip rate limiting if no user is authenticated
  if (!userId) {
    return next();
  }

  // Check query rate limit
  const rateLimitStatus = checkQueryRateLimit(userId);

  if (!rateLimitStatus.allowed) {
    const resetDate = new Date(rateLimitStatus.resetAt);
    return res.status(429).json({
      error: "Rate limit exceeded",
      code: "DB_RATE_LIMIT_EXCEEDED",
      message: `Database query limit exceeded (${rateLimitStatus.limit} queries per ${rateLimitStatus.windowSeconds}s)`,
      limit: rateLimitStatus.limit,
      windowSeconds: rateLimitStatus.windowSeconds,
      resetAt: rateLimitStatus.resetAt,
      retryAfter: Math.ceil((rateLimitStatus.resetAt - Date.now()) / 1000),
    });
  }

  // Set rate limit headers in response
  res.setHeader("X-RateLimit-Limit", rateLimitStatus.limit.toString());
  res.setHeader("X-RateLimit-Remaining", rateLimitStatus.remaining.toString());
  res.setHeader(
    "X-RateLimit-Reset",
    Math.ceil(rateLimitStatus.resetAt / 1000).toString()
  );

  // Log high usage
  if (rateLimitStatus.remaining <= 10) {
    console.warn(
      `[DB-Rate-Limit] User ${userId} approaching limit: ${rateLimitStatus.remaining} queries remaining`
    );
  }

  next();
}

/**
 * Optional: Stricter rate limiting for write operations
 * Returns 429 if too many concurrent write operations
 */
export function strictDbRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = (req as any).userId;
  if (!userId) return next();

  // Only apply strict limit to state-changing operations
  const isWriteOperation = ["POST", "PUT", "PATCH", "DELETE"].includes(
    req.method
  );

  // Exclude lightweight heartbeat/session pings from strict rate limiting
  const isHeartbeat =
    req.path === "/api/session/ping" ||
    req.path === "/api/auth/heartbeat" ||
    req.path === "/api/auth/me";

  if (isWriteOperation && !isHeartbeat) {
    const activeConnections = getActiveConnectionsCount(userId);
    // Stricter limit: max 2 concurrent writes per user
    if (activeConnections > 2) {
      return res.status(429).json({
        error: "Too many concurrent operations",
        code: "DB_CONCURRENT_OPERATION_LIMIT",
        message: "Too many concurrent write operations. Please try again.",
        activeConnections,
        maxAllowed: 2,
      });
    }
  }

  next();
}

/**
 * Middleware to extract and validate user ID from various sources
 * This should run AFTER authentication middleware
 */
export function extractUserIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Get user ID from authenticated session/JWT/auth context
  // Adjust this based on your auth mechanism
  if ((req as any).session?.userId) {
    (req as any).userId = (req as any).session.userId;
  } else if ((req as any).user?.id) {
    (req as any).userId = (req as any).user.id;
  } else if ((req as any).auth?.id) {
    (req as any).userId = (req as any).auth.id;
  }

  next();
}

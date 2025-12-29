import type { RequestHandler } from "express";
import { getPool, isDbEnabled, createUser } from "../store/db";
import { hashPassword } from "../utils/auth";

/**
 * Setup endpoint to create/reset admin user
 * This should only be available on first setup
 */
export const setupAdmin: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({
      error: "Database not enabled",
      message: "Database connection is required for setup",
    });
  }

  try {
    const p = getPool();

    // Check if any users exist
    const { rows } = await p.query(`SELECT COUNT(*)::int AS c FROM users`);
    const userCount = Number(rows[0]?.c || 0);

    if (userCount > 0) {
      // Users exist, cannot reset
      return res.status(400).json({
        error: "Users already exist",
        message:
          "Cannot create initial admin user. Use user management endpoints to add users.",
      });
    }

    // No users exist, create only the admin user (no demo users)
    const { hashPassword: hp } = await import("../utils/auth");

    await createUser({
      username: "admin",
      password_hash: hp("password"),
      role: "admin",
      window_id: null,
      disabled: false,
    });

    res.json({
      ok: true,
      message: "Admin user created successfully",
      user: {
        username: "admin",
        password: "password",
        role: "admin",
      },
      note: "Please change the default password immediately. Use user management endpoints to create additional users.",
    });
  } catch (error) {
    console.error("Setup error:", error);
    res.status(500).json({
      error: "Setup failed",
      message: (error as any)?.message || "An error occurred during setup",
      details:
        process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
};

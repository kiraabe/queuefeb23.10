import { RequestHandler } from "express";
import { hashPassword } from "../utils/auth";
import { getPool } from "../store/db";
import { randomUUID } from "node:crypto";

interface BulkUserImport {
  full_name: string;
  window_id?: number | null;
  job_title?: string;
  role: "reception" | "teller" | "admin" | "employee" | "archiever";
  department?: string;
}

export const bulkImportUsers: RequestHandler = async (req, res) => {
  try {
    const users = req.body as BulkUserImport[];

    if (!Array.isArray(users) || users.length === 0) {
      return res
        .status(400)
        .json({ error: "Request body must be a non-empty array of users" });
    }

    const temporaryPassword = "TempPassword123";
    const passwordHash = hashPassword(temporaryPassword);
    const pool = getPool();

    const importedUsers = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      try {
        const user = users[i];

        // Validate required fields
        if (!user.full_name || !user.role) {
          errors.push({
            index: i,
            error: "Missing required fields: full_name and role",
          });
          continue;
        }

        // Generate username from full name (replace spaces with underscores, lowercase)
        const username = user.full_name
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "");

        if (!username) {
          errors.push({
            index: i,
            error: "Could not generate username from full_name",
          });
          continue;
        }

        const userId = randomUUID();

        // Insert user
        await pool.query(
          `INSERT INTO users (id, username, password_hash, window_id, department) 
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, username, passwordHash, user.window_id ?? null, user.department ?? null],
        );

        // Insert role
        await pool.query(
          `INSERT INTO user_roles (user_id, role, is_primary) 
           VALUES ($1, $2, true)`,
          [userId, user.role],
        );

        importedUsers.push({
          id: userId,
          username,
          full_name: user.full_name,
          role: user.role,
          window_id: user.window_id ?? null,
          department: user.department ?? null,
        });
      } catch (error) {
        errors.push({
          index: i,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    }

    res.json({
      success: true,
      imported: importedUsers.length,
      failed: errors.length,
      importedUsers,
      errors: errors.length > 0 ? errors : undefined,
      temporaryPassword: importedUsers.length > 0 ? temporaryPassword : undefined,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

import type { RequestHandler } from "express";
import { getPool, isDbEnabled, listJobTitles } from "../store/db";
import { hashPassword } from "../utils/auth";
import { logAudit } from "../store/db";

// Job Title Management

export const listJobTitlesHandler: RequestHandler = async (_req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const jobTitles = await listJobTitles();
    res.json({ jobTitles });
  } catch (error) {
    console.error("Failed to list job titles", error);
    res.status(500).json({ error: "Failed to list job titles" });
  }
};

// Window Management

export const listUsers: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const p = getPool();
    const jobTitleId = (req.query.jobTitleId as string) || null;

    let query = `SELECT id, username, role, window_id, disabled, full_name, department, email, phone, job_title_id FROM users`;
    const params: any[] = [];

    if (jobTitleId) {
      query += ` WHERE job_title_id = $1`;
      params.push(jobTitleId);
    }

    query += ` ORDER BY role, username`;

    const { rows } = await p.query(query, params);

    const users = rows.map((r) => ({
      id: r.id,
      username: r.username,
      role: r.role,
      windowId: r.window_id,
      disabled: r.disabled,
      fullName: r.full_name,
      department: r.department,
      email: r.email,
      phone: r.phone,
      jobTitleId: r.job_title_id,
    }));

    if (jobTitleId) {
      console.log(
        `[listUsers] Fetched ${users.length} users for jobTitleId=${jobTitleId}:`,
        users.map((u) => ({ id: u.id, username: u.username, role: u.role })),
      );
    }

    res.json({ users });
  } catch (error) {
    console.error("Failed to list users", error);
    res.status(500).json({ error: "Failed to list users" });
  }
};

export const createUser: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const {
      username,
      password,
      role,
      windowId,
      fullName,
      department,
      email,
      phone,
      jobTitleId,
    } = req.body;

    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username is required" });
    }

    if (!["reception", "teller", "admin", "employee"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Validate teller-specific required fields
    if (role === "teller") {
      if (!fullName || typeof fullName !== "string") {
        return res
          .status(400)
          .json({ error: "Full name is required for tellers" });
      }
      if (!department || typeof department !== "string") {
        return res
          .status(400)
          .json({ error: "Department is required for tellers" });
      }
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required for tellers" });
      }
      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ error: "Phone is required for tellers" });
      }
    } else {
      // For non-teller roles, password is required
      if (!password || typeof password !== "string") {
        return res.status(400).json({ error: "Password is required" });
      }
    }

    const usernameTrimmed = username.trim().toLowerCase();
    if (usernameTrimmed.length < 3 || usernameTrimmed.length > 100) {
      return res
        .status(400)
        .json({ error: "Username must be 3-100 characters" });
    }

    // For tellers, generate a placeholder password (they use window password to login)
    let finalPassword: string;
    if (role === "teller") {
      // Tellers use window password, not their own password
      finalPassword = `teller_${usernameTrimmed}_${Date.now()}`;
    } else {
      if (password.length < 6) {
        return res
          .status(400)
          .json({ error: "Password must be at least 6 characters" });
      }
      finalPassword = password;
    }

    const passwordHash = hashPassword(finalPassword);
    const p = getPool();

    const userId = crypto.randomUUID();

    // Insert user without role column
    const { rows } = await p.query(
      `INSERT INTO users (id, username, password_hash, window_id, disabled, full_name, department, email, phone, job_title_id)
       VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8, $9)
       RETURNING id, username, window_id, full_name, department, email, phone, job_title_id`,
      [
        userId,
        usernameTrimmed,
        passwordHash,
        windowId && role === "teller" ? windowId : null,
        fullName || null,
        department || null,
        email || null,
        phone || null,
        jobTitleId || null,
      ],
    );

    if (!rows.length) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    const user = rows[0];

    // Insert role into user_roles table
    await p.query(
      `INSERT INTO user_roles (user_id, role, is_primary)
       VALUES ($1, $2, true)`,
      [userId, role],
    );

    const auth = (req as any).auth;
    await logAudit({
      action: "user.created",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { newUsername: user.username, newRole: role },
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: role,
        windowId: user.window_id,
        fullName: user.full_name,
        department: user.department,
        email: user.email,
        phone: user.phone,
        jobTitleId: user.job_title_id,
      },
      message: "User created successfully",
    });
  } catch (error: any) {
    console.error("Failed to create user", error);
    if (error?.code === "23505") {
      return res.status(400).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
};

export const updateUser: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const { id } = req.params;
    const {
      username,
      password,
      role,
      windowId,
      disabled,
      fullName,
      department,
      email,
      phone,
      jobTitleId,
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const p = getPool();

    // Get current user
    const currentRes = await p.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!currentRes.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentUser = currentRes.rows[0];
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (username !== undefined && username !== currentUser.username) {
      if (typeof username !== "string") {
        return res.status(400).json({ error: "Invalid username" });
      }
      const usernameTrimmed = username.trim().toLowerCase();
      if (usernameTrimmed.length < 3 || usernameTrimmed.length > 100) {
        return res
          .status(400)
          .json({ error: "Username must be 3-100 characters" });
      }
      updates.push(`username = $${paramCount}`);
      values.push(usernameTrimmed);
      paramCount++;
    }

    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 6) {
        return res
          .status(400)
          .json({ error: "Password must be at least 6 characters" });
      }
      updates.push(`password_hash = $${paramCount}`);
      values.push(hashPassword(password));
      paramCount++;
    }

    if (role !== undefined && role !== currentUser.role) {
      if (!["reception", "teller", "admin", "employee"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      updates.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (windowId !== undefined && currentUser.role === "teller") {
      updates.push(`window_id = $${paramCount}`);
      values.push(windowId || null);
      paramCount++;
    }

    if (disabled !== undefined) {
      updates.push(`disabled = $${paramCount}`);
      values.push(Boolean(disabled));
      paramCount++;
    }

    if (fullName !== undefined) {
      if (fullName !== null && typeof fullName !== "string") {
        return res.status(400).json({ error: "Invalid full name" });
      }
      updates.push(`full_name = $${paramCount}`);
      values.push(fullName ? fullName.trim() : null);
      paramCount++;
    }

    if (department !== undefined) {
      if (department !== null && typeof department !== "string") {
        return res.status(400).json({ error: "Invalid department" });
      }
      updates.push(`department = $${paramCount}`);
      values.push(department ? department.trim() : null);
      paramCount++;
    }

    if (email !== undefined) {
      if (email !== null && typeof email !== "string") {
        return res.status(400).json({ error: "Invalid email" });
      }
      updates.push(`email = $${paramCount}`);
      values.push(email ? email.trim() : null);
      paramCount++;
    }

    if (phone !== undefined) {
      if (phone !== null && typeof phone !== "string") {
        return res.status(400).json({ error: "Invalid phone" });
      }
      updates.push(`phone = $${paramCount}`);
      values.push(phone ? phone.trim() : null);
      paramCount++;
    }

    if (jobTitleId !== undefined) {
      if (jobTitleId !== null && typeof jobTitleId !== "string") {
        return res.status(400).json({ error: "Invalid job title" });
      }
      updates.push(`job_title_id = $${paramCount}`);
      values.push(jobTitleId ? jobTitleId.trim() : null);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.json({
        user: {
          id: currentUser.id,
          username: currentUser.username,
          role: currentUser.role,
          windowId: currentUser.window_id,
          disabled: currentUser.disabled,
          fullName: currentUser.full_name,
          department: currentUser.department,
          email: currentUser.email,
          phone: currentUser.phone,
          jobTitleId: currentUser.job_title_id,
        },
        message: "No changes made",
      });
    }

    values.push(id);
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id, username, role, window_id, disabled, full_name, department, email, phone, job_title_id`;

    const { rows } = await p.query(query, values);
    if (!rows.length) {
      return res.status(500).json({ error: "Failed to update user" });
    }

    const user = rows[0];
    const auth = (req as any).auth;
    await logAudit({
      action: "user.updated",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { targetUsername: user.username },
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        windowId: user.window_id,
        disabled: user.disabled,
        fullName: user.full_name,
        department: user.department,
        email: user.email,
        phone: user.phone,
        jobTitleId: user.job_title_id,
      },
      message: "User updated successfully",
    });
  } catch (error: any) {
    console.error("Failed to update user", error);
    if (error?.code === "23505") {
      return res.status(400).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Failed to update user" });
  }
};

export const deleteUser: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const p = getPool();

    // Get user details before deletion
    const userRes = await p.query(`SELECT username FROM users WHERE id = $1`, [
      id,
    ]);
    if (!userRes.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const username = userRes.rows[0].username;

    // Revoke all active sessions for this user
    await p.query(
      `UPDATE user_sessions SET revoked_at = now(), revoke_reason = 'User deleted' WHERE user_id = $1`,
      [id],
    );

    // Delete the user
    await p.query(`DELETE FROM users WHERE id = $1`, [id]);

    const auth = (req as any).auth;
    await logAudit({
      action: "user.deleted",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { deletedUsername: username },
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Failed to delete user", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

export const listWindows: RequestHandler = async (_req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT w.id, w.name, COUNT(u.id)::int as teller_count
       FROM windows w
       LEFT JOIN users u ON w.id = u.window_id AND u.role = 'teller'
       GROUP BY w.id, w.name
       ORDER BY w.id`,
    );

    const windows = rows.map((r) => ({
      id: r.id,
      name: r.name,
      tellerCount: r.teller_count,
    }));

    res.json({ windows });
  } catch (error) {
    console.error("Failed to list windows", error);
    res.status(500).json({ error: "Failed to list windows" });
  }
};

export const createWindow: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Window name is required" });
    }

    const nameTrimmed = name.trim();
    if (nameTrimmed.length < 1 || nameTrimmed.length > 255) {
      return res
        .status(400)
        .json({ error: "Window name must be 1-255 characters" });
    }

    const p = getPool();

    // Get the next window ID
    const maxIdRes = await p.query(
      `SELECT COALESCE(MAX(id), 0) as max_id FROM windows`,
    );
    const nextId = (maxIdRes.rows[0]?.max_id || 0) + 1;

    const { rows } = await p.query(
      `INSERT INTO windows (id, name, busy, updated_at)
       VALUES ($1, $2, false, now())
       RETURNING id, name`,
      [nextId, nameTrimmed],
    );

    if (!rows.length) {
      return res.status(500).json({ error: "Failed to create window" });
    }

    const window = rows[0];
    const auth = (req as any).auth;
    await logAudit({
      action: "window.created",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      windowId: window.id,
      details: { windowName: window.name },
    });

    res.json({
      window: { id: window.id, name: window.name, tellerCount: 0 },
      message: "Window created successfully",
    });
  } catch (error) {
    console.error("Failed to create window", error);
    res.status(500).json({ error: "Failed to create window" });
  }
};

export const updateWindow: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!id || !Number.isInteger(Number(id))) {
      return res.status(400).json({ error: "Invalid window ID" });
    }

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Window name is required" });
    }

    const nameTrimmed = name.trim();
    if (nameTrimmed.length < 1 || nameTrimmed.length > 255) {
      return res
        .status(400)
        .json({ error: "Window name must be 1-255 characters" });
    }

    const p = getPool();

    // Check if window exists
    const checkRes = await p.query(`SELECT id FROM windows WHERE id = $1`, [
      Number(id),
    ]);
    if (!checkRes.rows.length) {
      return res.status(404).json({ error: "Window not found" });
    }

    const { rows } = await p.query(
      `UPDATE windows SET name = $1, updated_at = now() WHERE id = $2 RETURNING id, name`,
      [nameTrimmed, Number(id)],
    );

    if (!rows.length) {
      return res.status(500).json({ error: "Failed to update window" });
    }

    const window = rows[0];
    const auth = (req as any).auth;
    await logAudit({
      action: "window.updated",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      windowId: Number(id),
      details: { newName: window.name },
    });

    res.json({
      window: { id: window.id, name: window.name },
      message: "Window updated successfully",
    });
  } catch (error) {
    console.error("Failed to update window", error);
    res.status(500).json({ error: "Failed to update window" });
  }
};

export const deleteWindow: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const { id } = req.params;

    if (!id || !Number.isInteger(Number(id))) {
      return res.status(400).json({ error: "Invalid window ID" });
    }

    const windowId = Number(id);
    if (windowId < 1) {
      return res.status(400).json({ error: "Invalid window ID" });
    }

    const p = getPool();

    // Check if window exists
    const windowRes = await p.query(`SELECT name FROM windows WHERE id = $1`, [
      windowId,
    ]);
    if (!windowRes.rows.length) {
      return res.status(404).json({ error: "Window not found" });
    }

    const windowName = windowRes.rows[0].name;

    // Check if window has assigned tellers
    const tellersRes = await p.query(
      `SELECT COUNT(*) as count FROM users WHERE window_id = $1 AND role = 'teller'`,
      [windowId],
    );

    if (tellersRes.rows[0].count > 0) {
      return res.status(400).json({
        error: "Cannot delete window with assigned tellers",
        message:
          "Please unassign all tellers from this window before deleting it.",
      });
    }

    // Delete the window
    await p.query(`DELETE FROM windows WHERE id = $1`, [windowId]);

    const auth = (req as any).auth;
    await logAudit({
      action: "window.deleted",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      windowId: windowId,
      details: { deletedWindowName: windowName },
    });

    res.json({
      message: "Window deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete window", error);
    res.status(500).json({ error: "Failed to delete window" });
  }
};

export const assignTellerToWindow: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const { userId } = req.params;
    const { windowId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const p = getPool();

    // Verify user is a teller
    const userRes = await p.query(
      `SELECT id, role, window_id FROM users WHERE id = $1`,
      [userId],
    );
    if (!userRes.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRes.rows[0];
    if (user.role !== "teller") {
      return res.status(400).json({ error: "Only tellers can be assigned" });
    }

    // Verify window exists if provided
    if (windowId !== null && windowId !== undefined) {
      if (!Number.isInteger(windowId)) {
        return res.status(400).json({ error: "Invalid window ID" });
      }
      const windowRes = await p.query(`SELECT id FROM windows WHERE id = $1`, [
        windowId,
      ]);
      if (!windowRes.rows.length) {
        return res.status(404).json({ error: "Window not found" });
      }
    }

    // Update user window assignment
    const { rows } = await p.query(
      `UPDATE users SET window_id = $1 WHERE id = $2 RETURNING id, username, role, window_id`,
      [windowId || null, userId],
    );

    if (!rows.length) {
      return res.status(500).json({ error: "Failed to assign window" });
    }

    const updatedUser = rows[0];
    const auth = (req as any).auth;
    await logAudit({
      action: "teller.assigned",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      windowId: windowId || undefined,
      details: { tellerUsername: updatedUser.username },
    });

    res.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        windowId: updatedUser.window_id,
      },
      message: "Teller assigned successfully",
    });
  } catch (error) {
    console.error("Failed to assign teller to window", error);
    res.status(500).json({ error: "Failed to assign teller to window" });
  }
};

export const resetWindowPassword: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const { windowId } = req.params;

    if (!windowId || !Number.isInteger(Number(windowId))) {
      return res.status(400).json({ error: "Invalid window ID" });
    }

    const id = Number(windowId);
    if (id < 1) {
      return res.status(400).json({ error: "Invalid window ID" });
    }

    const p = getPool();

    // Check if window exists
    const windowRes = await p.query(`SELECT id FROM windows WHERE id = $1`, [
      id,
    ]);
    if (!windowRes.rows.length) {
      return res.status(404).json({ error: "Window not found" });
    }

    // Check if window user exists (teller must be assigned first)
    const userRes = await p.query(
      `SELECT id FROM users WHERE window_id = $1 AND role = 'teller' LIMIT 1`,
      [id],
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({
        error: "teller not assign please assign",
        message:
          "No teller assigned to this window. Please assign a teller first before resetting the password.",
      });
    }

    // Generate new password
    const newPassword = `window_${id}_${Date.now()}`;
    const passwordHash = hashPassword(newPassword);
    const userId = userRes.rows[0].id;

    // Update existing window user password
    await p.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      userId,
    ]);

    const auth = (req as any).auth;
    await logAudit({
      action: "window.password.reset",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      windowId: id,
      details: { newPassword: newPassword },
    });

    res.json({
      windowId: id,
      password: newPassword,
      message: "Window password reset successfully",
    });
  } catch (error) {
    console.error("Failed to reset window password", error);
    res.status(500).json({ error: "Failed to reset window password" });
  }
};

export const resetUserPassword: RequestHandler = async (req, res) => {
  if (!isDbEnabled) {
    return res.status(400).json({ error: "DB not enabled" });
  }

  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const p = getPool();

    // Check if user exists
    const userRes = await p.query(
      `SELECT id, username, role FROM users WHERE id = $1`,
      [userId],
    );

    if (!userRes.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRes.rows[0];

    // Generate new password
    const newPassword = `${user.role}_${user.username}_${Date.now()}`;
    const passwordHash = hashPassword(newPassword);

    // Update user password
    await p.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      passwordHash,
      userId,
    ]);

    const auth = (req as any).auth;
    await logAudit({
      action: "user.password.reset",
      userId: auth?.id ?? null,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      details: { targetUserId: userId, targetUsername: user.username },
    });

    res.json({
      userId: userId,
      username: user.username,
      password: newPassword,
      message: "User password reset successfully",
    });
  } catch (error) {
    console.error("Failed to reset user password", error);
    res.status(500).json({ error: "Failed to reset user password" });
  }
};

import "dotenv/config";
import { Pool } from "pg";
import { scryptSync, randomBytes } from "node:crypto";
import { timingSafeEqual } from "node:crypto";

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

async function insertAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Connecting to database...");

    // Test connection
    await pool.query("SELECT 1");
    console.log("✓ Database connected");

    // Insert admin user
    const username = "admin";
    const password = "password";
    const passwordHash = hashPassword(password);

    console.log("Inserting admin user...");

    const result = await pool.query(
      `INSERT INTO users (id, username, password_hash, role, window_id, disabled) 
       VALUES (gen_random_uuid(), $1, $2, $3, NULL, false)
       ON CONFLICT (username) DO UPDATE SET 
         password_hash = $2,
         role = $3,
         disabled = false
       RETURNING id, username, role;`,
      [username, passwordHash, "admin"],
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log("✓ Admin user inserted successfully");
      console.log(`  Username: ${user.username}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Password: ${password}`);
    }
  } catch (error) {
    console.error(
      "✗ Error inserting admin user:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    await pool.end();
    console.log("Database connection closed");
  }
}

insertAdmin();

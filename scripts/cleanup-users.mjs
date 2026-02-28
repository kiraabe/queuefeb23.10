import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete user_roles for test users
    const deleteRoles = await client.query(
      `DELETE FROM user_roles WHERE user_id IN (
        SELECT id FROM users WHERE username LIKE 'user_%'
      )`
    );
    console.log(`Deleted ${deleteRoles.rowCount} roles`);

    // Delete test users
    const deleteUsers = await client.query(
      `DELETE FROM users WHERE username LIKE 'user_%'`
    );
    console.log(`Deleted ${deleteUsers.rowCount} users`);

    await client.query('COMMIT');
    console.log('Cleanup complete');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();

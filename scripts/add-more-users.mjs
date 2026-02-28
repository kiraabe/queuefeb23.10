import { scryptSync, randomBytes, randomUUID } from 'crypto';
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

function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`;
}

function generateUsername(index) {
  const userNum = String(index + 1).padStart(3, '0');
  return `user_${userNum}`;
}

const users = [
  { full_name: 'ዘሪሁን ኦልጅራ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ዳኛቸው ውበቴ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ተስፋዬ ባዬ', job_title: 'Senior Surveyor Specialist', role: 'employee', department: 'Back Office' },
];

async function addUsers() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const temporaryPassword = 'TempPassword123';
    const passwordHash = hashPassword(temporaryPassword);
    const importedUsers = [];
    const errors = [];

    // Start from user_019
    const startIndex = 18;

    for (let i = 0; i < users.length; i++) {
      try {
        const user = users[i];
        const username = generateUsername(startIndex + i);

        // Get job_title_id from job_title table
        const titleResult = await client.query(
          `SELECT id FROM job_title WHERE name_english = $1 LIMIT 1`,
          [user.job_title]
        );

        if (titleResult.rows.length === 0) {
          errors.push({
            index: i,
            error: `Job title not found: ${user.job_title}`,
          });
          continue;
        }

        const jobTitleId = titleResult.rows[0].id;
        const userId = randomUUID();

        // Insert user
        await client.query(
          `INSERT INTO users (id, username, password_hash, job_title_id, department) 
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, username, passwordHash, jobTitleId, user.department ?? null],
        );

        // Insert role
        await client.query(
          `INSERT INTO user_roles (user_id, role, is_primary) 
           VALUES ($1, $2, true)`,
          [userId, user.role],
        );

        // Update with full_name
        await client.query(
          `UPDATE users SET full_name = $1 WHERE id = $2`,
          [user.full_name, userId],
        );

        importedUsers.push({
          id: userId,
          username,
          full_name: user.full_name,
          role: user.role,
          job_title: user.job_title,
          department: user.department,
        });

        console.log(`✓ Added: ${username} - ${user.full_name} (${user.job_title})`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          index: i,
          error: errMsg,
        });
        console.error(`✗ Error adding user: ${errMsg}`);
      }
    }

    await client.query('COMMIT');

    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Added: ${importedUsers.length}/${users.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`\nTemporary password for all users: ${temporaryPassword}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach((e) => {
        console.log(`  Row ${e.index}: ${e.error}`);
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addUsers();

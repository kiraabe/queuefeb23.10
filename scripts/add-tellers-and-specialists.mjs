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
  { full_name: 'ፍቃዱ ዋጋው', window_id: 8, job_title: 'Legal Registration Officer', role: 'teller', department: 'Editor' },
  { full_name: 'ደረሰ ጥላሁን', window_id: 9, job_title: 'Legal Registration Officer', role: 'teller', department: 'Editor' },
  { full_name: 'ፍፁም ደምሴ', window_id: 10, job_title: 'Legal Registration Officer', role: 'teller', department: 'Editor' },
  { full_name: 'ንጉስ ደጀን', job_title: 'Senior Property Rights Registration Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ክብሬ ታደሰ', job_title: 'Senior Property Rights Registration Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ባኮስ ገረመው', job_title: 'Senior Property Rights Registration Specialist', role: 'employee', department: 'Back Office' },
];

async function addUsers() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const temporaryPassword = 'TempPassword123';
    const passwordHash = hashPassword(temporaryPassword);
    const importedUsers = [];
    const errors = [];

    // Start from user_022
    const startIndex = 21;

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
          `INSERT INTO users (id, username, password_hash, job_title_id, department, window_id) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, username, passwordHash, jobTitleId, user.department ?? null, user.window_id ?? null],
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
          window_id: user.window_id ?? null,
        });

        const windowInfo = user.window_id ? ` (Window ${user.window_id})` : '';
        console.log(`✓ Added: ${username} - ${user.full_name} (${user.job_title})${windowInfo}`);
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

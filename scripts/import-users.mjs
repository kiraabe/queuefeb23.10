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


function generateUsername(fullName, index) {
  // Generate username from initials + index to ensure uniqueness
  // For Amharic names, use "user_" prefix
  const userNum = String(index + 1).padStart(3, '0');
  return `user_${userNum}`;
}

const users = [
  { full_name: 'ሙሉ ዓላ', window_id: 1, job_title: 'Legal Registration Officer', role: 'teller', department: 'Editor' },
  { full_name: 'ዓለ ስለሳ', window_id: 2, job_title: 'Legal Registration Officer', role: 'teller', department: 'Editor' },
  { full_name: 'ዘየሐሰ ሩት', window_id: 3, job_title: 'Legal Registration Officer', role: 'teller', department: 'Editor' },
  { full_name: 'ሊይዝ ኩሪሞ', window_id: 4, job_title: 'Legal Registration Officer', role: 'teller', department: 'Editor' },
  { full_name: 'በእሸ ገ.ሊ', window_id: 5, job_title: 'Legal Registration Officer', role: 'teller', department: 'Editor' },
  { full_name: 'ሌላ መኑኑት', window_id: 6, job_title: 'Legal Registration Officer', role: 'teller', department: 'Editor' },
  { full_name: 'ኦገሞ ጋ.ዲ', job_title: 'Legal Registration Officer', role: 'employee', department: 'Back Office' },
  { full_name: 'ታፈዘ', job_title: 'Legal Registration Officer', role: 'employee', department: 'Back Office' },
  { full_name: 'ለ ብርሐ', job_title: 'Legal Registration Officer', role: 'employee', department: 'Back Office' },
  { full_name: 'መእለት ዱ.ሃ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ምርጥ ዓንገተ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ይበራ ሌ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ቢሪሌ ጋ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ወ (ቶሎ) ከተ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ላገር ታወደ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ወእዝ ኪጄ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ሚደነ', job_title: 'GIS Specialist', role: 'employee', department: 'Back Office' },
  { full_name: 'ተኸሰ ሚ', job_title: 'Senior Surveyor Specialist', role: 'employee', department: 'Back Office' },
];

async function importUsers() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const temporaryPassword = 'TempPassword123';
    const passwordHash = hashPassword(temporaryPassword);
    const importedUsers = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      try {
        const user = users[i];
        const username = generateUsername(user.full_name, i);

        const userId = randomUUID();

        // Insert user
        await client.query(
          `INSERT INTO users (id, username, password_hash, window_id, department) 
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, username, passwordHash, user.window_id ?? null, user.department ?? null],
        );

        // Insert role
        await client.query(
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

        console.log(`✓ Imported: ${user.full_name} (${username})`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          index: i,
          error: errMsg,
        });
        console.error(`✗ Error importing user ${i}: ${errMsg}`);
      }
    }

    await client.query('COMMIT');

    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Imported: ${importedUsers.length}/${users.length}`);
    console.log(`Failed: ${errors.length}`);
    console.log(`\nTemporary password for all users: ${temporaryPassword}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach((e) => {
        console.log(`  Row ${e.index}: ${e.error}`);
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

importUsers();

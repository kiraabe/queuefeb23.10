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

const users = [
  { username: 'user_001', full_name: 'ፀጋስላሴ ግዛው', job_title: 'Legal Registration Officer' },
  { username: 'user_002', full_name: 'ዴሲሳ አስፋው', job_title: 'Legal Registration Officer' },
  { username: 'user_003', full_name: 'ሙልጌታ ዶላሶ', job_title: 'Legal Registration Officer' },
  { username: 'user_004', full_name: 'ፈይራ ኢንሰርሙ', job_title: 'Legal Registration Officer' },
  { username: 'user_005', full_name: 'ሀይሉ ጋረደው', job_title: 'Legal Registration Officer' },
  { username: 'user_006', full_name: 'አቤል መኳንንት', job_title: 'Legal Registration Officer' },
  { username: 'user_007', full_name: 'ጌታሁን ይርዳው', job_title: 'Legal Registration Officer' },
  { username: 'user_008', full_name: 'ወንዱ በቀለ', job_title: 'Legal Registration Officer' },
  { username: 'user_009', full_name: 'ፍሬሂወት ደምሴ', job_title: 'Legal Registration Officer' },
  { username: 'user_010', full_name: 'ሐዩ ነገራ', job_title: 'Legal Registration Officer' },
  { username: 'user_011', full_name: 'ሙሉአለም ሽፈራው', job_title: 'GIS Specialist' },
  { username: 'user_012', full_name: 'ምስራቅ ነጋሽ', job_title: 'GIS Specialist' },
  { username: 'user_013', full_name: 'ዬርዳኖስ አበራ', job_title: 'GIS Specialist' },
  { username: 'user_014', full_name: 'ይኸይስ ደጉ', job_title: 'GIS Specialist' },
  { username: 'user_015', full_name: 'ወንደሰን ግርማ', job_title: 'GIS Specialist' },
  { username: 'user_016', full_name: 'ውብዓለም ሰጡ', job_title: 'GIS Specialist' },
  { username: 'user_017', full_name: 'እምሩ ገመቹ', job_title: 'GIS Specialist' },
  { username: 'user_018', full_name: 'መልካም አስረሴ', job_title: 'GIS Specialist' },
];

async function updateUsers() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let updated = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Get job_title_id from job_title table
        const titleResult = await client.query(
          `SELECT id FROM job_title WHERE name_english = $1 LIMIT 1`,
          [user.job_title]
        );

        if (titleResult.rows.length === 0) {
          console.error(`✗ Job title not found: ${user.job_title}`);
          errors++;
          continue;
        }

        const jobTitleId = titleResult.rows[0].id;

        // Update user with full_name and job_title_id
        const result = await client.query(
          `UPDATE users SET full_name = $1, job_title_id = $2 WHERE username = $3`,
          [user.full_name, jobTitleId, user.username]
        );

        if (result.rowCount > 0) {
          console.log(`✓ Updated: ${user.username} - ${user.full_name}`);
          updated++;
        } else {
          console.error(`✗ User not found: ${user.username}`);
          errors++;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`✗ Error updating ${user.username}: ${errMsg}`);
        errors++;
      }
    }

    await client.query('COMMIT');

    console.log('\n=== UPDATE SUMMARY ===');
    console.log(`Updated: ${updated}/${users.length}`);
    console.log(`Errors: ${errors}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateUsers();

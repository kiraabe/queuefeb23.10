import { Pool } from "pg";

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function removeOldDuplicates() {
  try {
    const duplicates = [
      "የፍትህ ተቋማት ምላሽ",
      "መረጃ ወቅታዊ ማድረግ",
    ];

    for (const serviceName of duplicates) {
      // Get all instances of this service ordered by whether they have standard_time_minutes
      const res = await p.query(
        `SELECT id, standard_time_minutes 
         FROM services 
         WHERE name = $1
         ORDER BY standard_time_minutes NULLS FIRST, created_at`,
        [serviceName]
      );

      if (res.rows.length > 1) {
        console.log(`Service: "${serviceName}"`);
        console.log(`  Found ${res.rows.length} instances`);

        // Keep the one with standard_time_minutes (newer), delete the ones with NULL
        const toDelete = res.rows.filter((r) => r.standard_time_minutes === null);

        for (const row of toDelete) {
          await p.query(`DELETE FROM services WHERE id = $1`, [row.id]);
          console.log(`  ✓ Deleted old entry (standard_time_minutes: NULL)`);
        }
      }
    }

    console.log("\n✓ Old duplicate entries removed!");
    await p.end();
  } catch (error) {
    console.error("Error removing duplicates:", error);
    await p.end();
    process.exit(1);
  }
}

removeOldDuplicates();

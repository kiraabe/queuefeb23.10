import { Pool } from "pg";

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function removeDuplicates() {
  try {
    // Find and remove duplicate services, keeping only the first one
    const duplicates = [
      { name: "የፍትህ ተቋማት ምላሽ", standardTimeMinutes: 170 },
      { name: "መረጃ ወቅታዊ ማድረግ", standardTimeMinutes: 193 },
    ];

    for (const dup of duplicates) {
      // Get all instances of this service
      const res = await p.query(
        `SELECT id FROM services 
         WHERE name = $1 AND standard_time_minutes = $2
         ORDER BY created_at`,
        [dup.name, dup.standardTimeMinutes]
      );

      if (res.rows.length > 1) {
        // Keep the first one, delete the rest
        const idsToDelete = res.rows.slice(1).map((r) => r.id);
        console.log(
          `Found ${res.rows.length} instances of "${dup.name}". Deleting ${idsToDelete.length} duplicate(s)...`
        );

        for (const id of idsToDelete) {
          await p.query(`DELETE FROM services WHERE id = $1`, [id]);
        }
        console.log(`✓ Deleted duplicates for "${dup.name}"`);
      }
    }

    console.log("\n✓ Duplicate removal complete!");
    await p.end();
  } catch (error) {
    console.error("Error removing duplicates:", error);
    await p.end();
    process.exit(1);
  }
}

removeDuplicates();

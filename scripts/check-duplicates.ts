import { Pool } from "pg";

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkDuplicates() {
  try {
    const res = await p.query(
      `SELECT name, standard_time_minutes, COUNT(*) as count
       FROM services
       GROUP BY name, standard_time_minutes
       HAVING COUNT(*) > 1`
    );

    if (res.rows.length === 0) {
      console.log("✓ No duplicate services found!");
    } else {
      console.log("Found duplicates:");
      res.rows.forEach((row) => {
        console.log(
          `- "${row.name}" (${row.standard_time_minutes}min): ${row.count} instances`
        );
      });
    }

    // Show all services count
    const allRes = await p.query(`SELECT COUNT(*) as total FROM services`);
    console.log(`\nTotal services: ${allRes.rows[0].total}`);

    await p.end();
  } catch (error) {
    console.error("Error:", error);
    await p.end();
  }
}

checkDuplicates();

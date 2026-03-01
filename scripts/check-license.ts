import { getPool } from "../server/store/db";

async function checkLicense() {
  try {
    const p = getPool();
    const res = await p.query("SELECT count(*) FROM licenses");
    console.log(`License count: ${res.rows[0].count}`);
    const licenses = await p.query("SELECT id, licensee, status FROM licenses");
    console.log("Licenses:", JSON.stringify(licenses.rows, null, 2));
  } catch (error) {
    console.error("Error checking license:", error);
  } finally {
    process.exit(0);
  }
}

checkLicense();

import { getPool } from "../server/store/db";

async function checkStatus() {
  try {
    const p = getPool();
    const licenses = await p.query("SELECT id, licensee, status FROM licenses");
    console.log("Licenses:", JSON.stringify(licenses.rows, null, 2));
    
    const users = await p.query("SELECT id, username FROM users");
    console.log("Users count:", users.rows.length);
    console.log("Users:", JSON.stringify(users.rows, null, 2));
  } catch (error) {
    console.error("Error checking status:", error);
  } finally {
    process.exit(0);
  }
}

checkStatus();

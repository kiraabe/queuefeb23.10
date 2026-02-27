import { Pool } from "pg";
import crypto from "crypto";

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface ServiceData {
  name: string;
  standardTimeMinutes: number;
  category: string;
}

const servicesData: ServiceData[] = [
  // Rights Group Services
  { name: "አዲስ ምዝገባ አገልግሎት", standardTimeMinutes: 99, category: "rights-group" },
  { name: "የፍትህ ተቋማት ምላሽ", standardTimeMinutes: 170, category: "rights-group" },

  // Fixed Property Group Services
  { name: "የንብረት ትመና አገልግሎት", standardTimeMinutes: 158, category: "fixed-property-group" },
  { name: "የግብር ተመን", standardTimeMinutes: 158, category: "fixed-property-group" },

  // Cadastral Group Services
  { name: "የይዞታ ይካፈልልኝ አገልግሎት", standardTimeMinutes: 221, category: "cadastral-group" },
  { name: "የይዞታ ይቀላቀልልኝ አገልግሎት", standardTimeMinutes: 221, category: "cadastral-group" },
  { name: "የተበላሸ ወይም የጠፋ ሰርተፍኬት ምትክ መስጠት", standardTimeMinutes: 59, category: "cadastral-group" },
  { name: "መረጃ ወቅታዊ ማድረግ", standardTimeMinutes: 193, category: "cadastral-group" },
  { name: "ስመ ንብረት ዝውውር", standardTimeMinutes: 199, category: "cadastral-group" },
  { name: "የንብረት መያዣ ስረዛ", standardTimeMinutes: 48, category: "cadastral-group" },
  { name: "የወሰን ነጥብ ለውጥ", standardTimeMinutes: 186, category: "cadastral-group" },
  { name: "የይዞታ አገልግሎት ለውጥ", standardTimeMinutes: 131, category: "cadastral-group" },
  { name: "የማህበራት እና ሪል እቴት ተናጠል ካርታ መስጠት", standardTimeMinutes: 1228, category: "cadastral-group" },
  { name: "የይካተትልኝ አገልግሎት", standardTimeMinutes: 71, category: "cadastral-group" },
  { name: "የህጋዊ ካዳስተር ቅጂ", standardTimeMinutes: 30, category: "cadastral-group" },
  { name: "የወሰን ችካል", standardTimeMinutes: 143, category: "cadastral-group" },
  { name: "የእግድ ምዝገባ", standardTimeMinutes: 48, category: "rights-group" },
  { name: "የንብረት መያዣ ምዝገባ", standardTimeMinutes: 48, category: "rights-group" },
];

async function insertServices() {
  try {
    // Get all service categories
    const catRes = await p.query(`SELECT id, code FROM service_categories`);
    const catMap: Record<string, string> = Object.fromEntries(
      catRes.rows.map((r) => [r.code, r.id])
    );

    // Count existing services per category to determine next code
    const codeCounts: Record<string, number> = {};
    for (const category of ["rights-group", "cadastral-group", "fixed-property-group"]) {
      if (catMap[category]) {
        const res = await p.query(
          `SELECT COUNT(*) as count FROM services WHERE category_id = $1`,
          [catMap[category]]
        );
        codeCounts[category] = parseInt(res.rows[0].count, 10);
      }
    }

    // Helper function to generate deterministic UUID
    function generateServiceUUID(categoryCode: string, serviceCode: string): string {
      const namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // DNS namespace
      const data = `${categoryCode}:${serviceCode}`;
      const hash = crypto.createHash("sha1");
      hash.update(Buffer.from(namespace.replace(/-/g, ""), "hex"));
      hash.update(data);
      const digest = hash.digest();

      // Set version to 5 and variant to RFC 4122
      digest[6] = (digest[6] & 0x0f) | 0x50;
      digest[8] = (digest[8] & 0x3f) | 0x80;

      const hex = digest.toString("hex");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }

    // Insert services
    let insertCount = 0;
    for (const service of servicesData) {
      const categoryCode = service.category;
      if (!catMap[categoryCode]) {
        console.warn(`Category ${categoryCode} not found, skipping service: ${service.name}`);
        continue;
      }

      // Generate next service code
      const codePrefix = categoryCode === "rights-group" ? "RG" : 
                        categoryCode === "cadastral-group" ? "CG" : "FP";
      const nextNumber = ++codeCounts[categoryCode];
      const serviceCode = `${codePrefix}${String(nextNumber).padStart(2, "0")}`;
      const serviceUUID = generateServiceUUID(categoryCode, serviceCode);

      // Insert or update service
      await p.query(
        `INSERT INTO services (id, category_id, code, name, display_order, standard_time_minutes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (category_id, code) DO UPDATE 
         SET name=$4, standard_time_minutes=$6, display_order=$5;`,
        [
          serviceUUID,
          catMap[categoryCode],
          serviceCode,
          service.name,
          nextNumber - 1,
          service.standardTimeMinutes,
        ]
      );
      insertCount++;
      console.log(`✓ Inserted/Updated: ${service.name} (${serviceCode}) - ${service.standardTimeMinutes} minutes`);
    }

    console.log(`\nSuccessfully inserted/updated ${insertCount} services`);
    await p.end();
  } catch (error) {
    console.error("Error inserting services:", error);
    await p.end();
    process.exit(1);
  }
}

insertServices();

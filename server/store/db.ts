import { Pool } from "pg";
import type {
  DisplayState,
  DisplayTicket,
  ServiceType,
  Ticket,
  WindowState,
} from "../../shared/api";
import { formatTicketCode } from "../../shared/api";

export const isDbEnabled = true; // DB-only mode - no in-memory fallback

let pool: Pool | null = null;

export function getPool() {
  if (!isDbEnabled) throw new Error("DB not enabled");
  if (!pool) {
    const raw = (process.env.DATABASE_URL || "").trim();
    // Support values that may include a 'KEY=VALUE' wrapper or trailing semicolons
    const cleaned = (() => {
      if (!raw) return raw;
      const noTrailing = raw.replace(/;+$/u, "");
      const idx = noTrailing.indexOf("postgresql://");
      if (idx !== -1) return noTrailing.slice(idx);
      const idx2 = noTrailing.indexOf("postgres://");
      if (idx2 !== -1) return noTrailing.slice(idx2);
      // If formatted like KEY=VALUE, take the part after the first '='
      const eq = noTrailing.indexOf("=");
      if (eq !== -1 && noTrailing.slice(eq + 1).includes("://")) {
        return noTrailing.slice(eq + 1);
      }
      return noTrailing;
    })();

    pool = new Pool({
      connectionString: cleaned,
      ssl: { rejectUnauthorized: false },
    });
    pool.on("error", (err) => console.error("Database connection error:", err));
  }
  return pool;
}

export async function initDb() {
  if (!isDbEnabled) return;
  const p = getPool();
  try {
    try {
      await p.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    } catch {
      // ignore if not permitted; we'll generate UUIDs in app code
    }
    await p.query(`CREATE TABLE IF NOT EXISTS windows (
    id int primary key,
    name text not null,
    current_ticket_id uuid,
    busy boolean not null default false,
    updated_at timestamptz not null default now()
  );`);
    await p.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    action text not null,
    user_id uuid,
    username text,
    role text,
    window_id int,
    details jsonb
  );`);
    await p.query(`CREATE TABLE IF NOT EXISTS tickets (
    id uuid primary key,
    service text not null,
    number int not null,
    code text not null,
    status text not null,
    window_id int,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz,
    notes text,
    owner_name text,
    woreda text,
    remark text,
    skipped_at timestamptz,
    skipped_by_window int
  );`);
    // Backfill columns if table existed
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS owner_name text;`,
    );
    await p.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS woreda text;`);
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS started_at timestamptz;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS completed_at timestamptz;`,
    );
    await p.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS remark text;`);
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS skipped_at timestamptz;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS skipped_by_window int;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transferred_from_window int;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transferred_to_window int;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transferred_at timestamptz;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS expired_at timestamptz;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transferred_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL;`,
    );
    await p.query(`CREATE TABLE IF NOT EXISTS service_counters (
    service text primary key,
    next_number int not null,
    counter_date date not null default current_date
  );`);
    await p.query(`CREATE TABLE IF NOT EXISTS users (
    id uuid primary key,
    username text not null unique,
    password_hash text not null,
    role text not null check (role in ('reception','teller','admin','employee')),
    window_id int,
    full_name text,
    department text,
    email text,
    phone text,
    job_title_id uuid REFERENCES job_title(id) ON DELETE SET NULL
  );`);
    // Add disabled flag for account locking
    await p.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled boolean DEFAULT false;`,
    );
    // Add teller info columns if they don't exist
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text;`);
    await p.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS department text;`,
    );
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;`);
    // Remove position column if it exists and migrate to job_title_id
    await p.query(`ALTER TABLE users DROP COLUMN IF EXISTS position;`);
    await p.query(`CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    username text not null,
    role text not null check (role in ('reception','teller','admin','employee')),
    window_id int,
    token_hash text not null unique,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    revoke_reason text
  );`);
    await p.query(
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash)`,
    );
    await p.query(
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`,
    );
    // seed windows 1..6
    for (let i = 1; i <= 20; i++) {
      await p.query(
        `INSERT INTO windows (id, name, busy) VALUES ($1, $2, false)
       ON CONFLICT (id) DO NOTHING;`,
        [i, `Window ${i}`],
      );
    }
    const serviceCategories: ServiceType[] = [
      "rights-group",
      "cadastral-group",
      "fixed-property-group",
    ];
    for (const s of serviceCategories) {
      await p.query(
        `INSERT INTO service_counters (service, next_number) VALUES ($1, 1)
         ON CONFLICT (service) DO NOTHING;`,
        [s],
      );
    }
    // Ensure a global daily counter exists for unified ticket numbering across services
    await p.query(
      `INSERT INTO service_counters (service, next_number) VALUES ('GLOBAL', 1)
       ON CONFLICT (service) DO NOTHING;`,
    );
    // Ensure per-day uniqueness for ticket codes and add counter_date column for counters
    await p
      .query(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_code_key;`)
      .catch(() => {});
    // Create a unique index to ensure per-day uniqueness for ticket codes.
    // Some hosted Postgres providers disallow non-IMMUTABLE functions in index expressions (e.g. date(created_at)).
    // Try creating the index, but if it fails due to immutability restrictions, log a warning and continue.
    try {
      await p.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uniq_tickets_code_day ON tickets (code, (date(created_at)));`,
      );
    } catch (e) {
      console.warn(
        "Could not create uniq_tickets_code_day index - continuing without it:",
        e?.message ?? e,
      );
    }
    await p.query(
      `ALTER TABLE service_counters ADD COLUMN IF NOT EXISTS counter_date date;`,
    );
    await p.query(
      `UPDATE service_counters SET counter_date = current_date WHERE counter_date IS NULL;`,
    );
    await p.query(`CREATE TABLE IF NOT EXISTS transfer_history (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null,
    from_window int not null,
    to_window int not null,
    transferred_at timestamptz not null default now()
  );`);
    try {
      await p.query(
        `CREATE INDEX IF NOT EXISTS idx_transfer_history_ticket ON transfer_history(ticket_id)`,
      );
    } catch {}
    try {
      await p.query(
        `CREATE INDEX IF NOT EXISTS idx_transfer_history_from_window ON transfer_history(from_window)`,
      );
    } catch {}
    try {
      await p.query(
        `CREATE INDEX IF NOT EXISTS idx_transfer_history_to_window ON transfer_history(to_window)`,
      );
    } catch {}

    // Queue settings table
    await p.query(`CREATE TABLE IF NOT EXISTS queue_settings (
    id int primary key default 1,
    max_tickets_per_day int not null default 200,
    daily_reset_time_utc text not null default '00:00',
    fifo_mode boolean not null default true,
    enable_ticket_transfers boolean not null default true,
    updated_at timestamptz not null default now(),
    updated_by uuid
  );`);

    // Seed default queue settings
    await p.query(
      `INSERT INTO queue_settings (id, max_tickets_per_day, daily_reset_time_utc, fifo_mode, enable_ticket_transfers)
       VALUES (1, 200, '00:00', true, true)
       ON CONFLICT (id) DO NOTHING;`,
    );

    // Window Services mapping table (maps windows to allowed service categories)
    await p.query(`CREATE TABLE IF NOT EXISTS window_services (
    id uuid primary key default gen_random_uuid(),
    window_id int not null references windows(id) on delete cascade,
    service_category_code text not null,
    created_at timestamptz not null default now(),
    unique(window_id, service_category_code)
  );`);
    await p.query(
      `CREATE INDEX IF NOT EXISTS idx_window_services_window_id ON window_services(window_id)`,
    );

    // Service Categories table
    await p.query(`CREATE TABLE IF NOT EXISTS service_categories (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null unique,
    display_order int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );`);

    // Services table (individual services within categories)
    await p.query(`CREATE TABLE IF NOT EXISTS services (
    id uuid primary key default gen_random_uuid(),
    category_id uuid not null references service_categories(id) on delete cascade,
    code text not null,
    name text not null,
    display_order int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(category_id, code)
  );`);

    // Add selected_services column to tickets if it doesn't exist
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS service_category text;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS selected_services jsonb;`,
    );
    // Case workflow columns - for employee case tracking
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS started_at timestamptz;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS started_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS proceeded_at timestamptz;`,
    );
    await p.query(
      `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS job_title_for_proceed uuid REFERENCES job_title(id) ON DELETE SET NULL;`,
    );

    // Seed service categories and services in Amharic
    const categories = [
      { code: "rights-group", name: "የመብት ቡድን" },
      { code: "cadastral-group", name: "የካዳስተር ቡድን" },
      { code: "fixed-property-group", name: "የቋሚ ንብረት ምዝገባ ቡድን" },
    ];

    for (const cat of categories) {
      await p.query(
        `INSERT INTO service_categories (code, name) VALUES ($1, $2)
         ON CONFLICT (code) DO NOTHING;`,
        [cat.code, cat.name],
      );
    }

    // Fetch the category IDs to seed services
    const catRes = await p.query(`SELECT id, code FROM service_categories`);
    const catMap = Object.fromEntries(catRes.rows.map((r) => [r.code, r.id]));

    // Helper function to generate deterministic UUID for a service
    // Uses the category code and service code to create a stable UUID
    const { createHash } = await import("node:crypto");
    const generateServiceUUID = (
      categoryCode: string,
      serviceCode: string,
    ): string => {
      const namespace = "services:";
      const combined = namespace + categoryCode + ":" + serviceCode;
      const hash = createHash("sha256").update(combined).digest();
      // Convert first 16 bytes of hash to a valid UUID format
      const uuid = [
        hash.slice(0, 4).toString("hex"),
        hash.slice(4, 6).toString("hex"),
        hash.slice(6, 8).toString("hex"),
        hash.slice(8, 10).toString("hex"),
        hash.slice(10, 16).toString("hex"),
      ].join("-");
      return uuid;
    };

    // Note: Do NOT delete tickets or services on initialization
    // We use INSERT...ON CONFLICT DO UPDATE to handle service updates
    // while preserving all existing ticket and proceed data across restarts

    // Rights Group Services
    if (catMap["rights-group"]) {
      const rightsServices = [
        "የንብረት መያዣ ምዝገባ",
        "የንብረት መያዣ ስረዛ",
        "የእግድ ምዝገባ",
        "የህጋዊ ካዳስተር ቅጂ",
        "የፍትህ ተቋማት ምላሽ",
        "መረጃ ወቅታዊ ማድረግ",
        "የጠፋ ሰርተፍኬት ጋዜጣ ማሳወጅ",
      ];
      for (let i = 0; i < rightsServices.length; i++) {
        const serviceCode = `RG${String(i + 1).padStart(2, "0")}`;
        const serviceUUID = generateServiceUUID("rights-group", serviceCode);
        // First try to insert. If it exists, update name and display_order
        await p.query(
          `INSERT INTO services (id, category_id, code, name, display_order)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (category_id, code) DO UPDATE SET name=$4, display_order=$5;`,
          [
            serviceUUID,
            catMap["rights-group"],
            serviceCode,
            rightsServices[i],
            i,
          ],
        );
      }
    }

    // Cadastral Group Services
    if (catMap["cadastral-group"]) {
      const cadastralServices = [
        "ስመ ንብረት ዝውውር",
        "የአገልግሎት ለውጥ",
        "የይካፈልልኝ አገልግሎት",
        "የይዞታ ይቀላቀልልኝ አገልግሎት",
        "የፍትህ ተቋማት ምላሽ",
        "የወሰን ችካል",
        "የማህበራት እና ሪል እቴት ተናጠል ካርታ መስጠት",
        "መረጃ ወቅታዊ ማድረግ",
        "የተበላሸ ወይም የጠፋ ሰርተፍኬት ምትክ መስጠት",
        "የወሰን ነጥብ መቀየር",
        "የይካተትልኝ አገልግሎት",
      ];
      for (let i = 0; i < cadastralServices.length; i++) {
        const serviceCode = `CG${String(i + 1).padStart(2, "0")}`;
        const serviceUUID = generateServiceUUID("cadastral-group", serviceCode);
        // First try to insert. If it exists, update name and display_order
        await p.query(
          `INSERT INTO services (id, category_id, code, name, display_order)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (category_id, code) DO UPDATE SET name=$4, display_order=$5;`,
          [
            serviceUUID,
            catMap["cadastral-group"],
            serviceCode,
            cadastralServices[i],
            i,
          ],
        );
      }
    }

    // Fixed Property Group Services
    if (catMap["fixed-property-group"]) {
      const fixedPropertyServices = ["የንብረት ትመና አገልግሎት", "የግብር ተመን"];
      for (let i = 0; i < fixedPropertyServices.length; i++) {
        const serviceCode = `FP${String(i + 1).padStart(2, "0")}`;
        const serviceUUID = generateServiceUUID(
          "fixed-property-group",
          serviceCode,
        );
        // First try to insert. If it exists, update name and display_order
        await p.query(
          `INSERT INTO services (id, category_id, code, name, display_order)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (category_id, code) DO UPDATE SET name=$4, display_order=$5;`,
          [
            serviceUUID,
            catMap["fixed-property-group"],
            serviceCode,
            fixedPropertyServices[i],
            i,
          ],
        );
      }
    }

    // Seed window-service category mappings
    // Windows 1-7 → Cadastral Group (የካዳስተር ቡድን)
    // Windows 8-19 → Rights Group (የመብት ቡድን)
    // Windows 20-25 → Fixed Property Group (የቋሚ ንብረት ምዝገባ ቡድን)
    const windowServiceMappings = [
      { windows: [1, 2, 3, 4, 5, 6, 7], category: "cadastral-group" },
      {
        windows: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
        category: "rights-group",
      },
      { windows: [20, 21, 22, 23, 24, 25], category: "fixed-property-group" },
    ];

    // First, clear existing mappings to ensure clean state
    await p.query(`DELETE FROM window_services;`);

    // Then seed the correct mappings
    for (const mapping of windowServiceMappings) {
      for (const windowId of mapping.windows) {
        await p.query(
          `INSERT INTO window_services (window_id, service_category_code)
           VALUES ($1, $2)
           ON CONFLICT (window_id, service_category_code) DO NOTHING;`,
          [windowId, mapping.category],
        );
      }
    }

    // Verify seeding was successful
    const verifyRes = await p.query(
      `SELECT COUNT(*) as count FROM window_services;`,
    );
    const seedCount = Number(verifyRes.rows[0]?.count || 0);
    console.log(
      `✅ Window-service mappings seeded: ${seedCount} total assignments`,
    );

    // Log the mapping for verification
    const mappingRes = await p.query(
      `SELECT ws.window_id, ws.service_category_code
       FROM window_services ws
       ORDER BY ws.window_id;`,
    );
    const mappingByService: Record<string, number[]> = {};
    for (const row of mappingRes.rows) {
      const service = row.service_category_code;
      if (!mappingByService[service]) {
        mappingByService[service] = [];
      }
      mappingByService[service].push(row.window_id);
    }
    for (const [service, windows] of Object.entries(mappingByService)) {
      console.log(`   • ${service}: Windows [${windows.join(", ")}]`);
    }

    // Create job_title table if it doesn't exist
    await p.query(`CREATE TABLE IF NOT EXISTS job_title (
    id uuid primary key default gen_random_uuid(),
    name_amharic text not null,
    name_english text not null,
    display_order int,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(name_amharic)
  );`);

    // Add job_title_id column to users table if it doesn't exist
    await p.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title_id uuid REFERENCES job_title(id) ON DELETE SET NULL;`,
    );

    // Seed job titles
    const jobTitles = [
      {
        amharic: "የመረጃ እና ዶክመንቴሽን ባለሙያ",
        english: "Documentation and Information Specialist",
        order: 1,
      },
      {
        amharic: "መብት መዝጋቢ ባለሙያ",
        english: "Legal Registration Officer",
        order: 2,
      },
      {
        amharic: "የፕላን ምህንድስና ጥናትና ትመና ባለሙያ",
        english: "Survey Planning Engineer",
        order: 3,
      },
      {
        amharic: "የካዳስተር/ ከፍተኛ ቀያሽ ባለሙያ",
        english: "Senior Surveyor Specialist",
        order: 4,
      },
      {
        amharic: "የመብት መዝጋቢ  ከፍተኛ ባለሙያ",
        english: "Senior Property Rights Registration Specialist",
        order: 5,
      },
      {
        amharic: "የጂአይ ኤስ ባለሙያ",
        english: "GIS Specialist",
        order: 6,
      },
      {
        amharic: "የስርጭት ባለሙያ",
        english: "Distribution Officer",
        order: 7,
      },
      {
        amharic: "የአገልግሎት ዳይሬክቶሬት ዳይሬክተር",
        english: "Directorate Director",
        order: 8,
      },
      {
        amharic: "የተገልጋይ መስተንግጾ ባለሙያ",
        english: "Reception Officer",
        order: 9,
      },
    ];

    // Insert job titles if they don't exist
    for (const title of jobTitles) {
      await p.query(
        `INSERT INTO job_title (name_amharic, name_english, display_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (name_amharic) DO NOTHING;`,
        [title.amharic, title.english, title.order],
      );
    }

    // Reset started_at for all transferred tickets to ensure employees see the Start button first
    // This handles any existing tickets that were transferred with old logic
    try {
      const resetResult = await p.query(
        `UPDATE tickets
         SET started_at = NULL, started_by_user_id = NULL, proceeded_at = NULL
         WHERE status = 'transferred'
         AND transferred_to_user_id IS NOT NULL
         AND transferred_at IS NOT NULL`,
      );
      if (resetResult.rowCount && resetResult.rowCount > 0) {
        console.log(
          `✅ Reset ${resetResult.rowCount} transferred tickets to show Start button first`,
        );
      }
    } catch (error) {
      console.log(
        "ℹ️  Note: Could not reset existing tickets (this is normal if none exist yet)",
      );
    }

    // Admin user creation has been removed - users must be created explicitly through the setup/management API
    console.log(
      "ℹ️  Database initialization complete. No demo users or test data created.",
    );
  } catch (error) {
    throw error;
  }
}

export async function listWindowsDb(): Promise<WindowState[]> {
  const { rows } = await getPool().query(
    `SELECT
      w.id,
      w.name,
      w.current_ticket_id,
      w.busy,
      extract(epoch from w.updated_at)*1000 as updated_at,
      us.user_id as teller_id,
      us.username as teller_username
    FROM windows w
    LEFT JOIN user_sessions us ON w.id = us.window_id AND us.revoked_at IS NULL AND us.expires_at > now()
    ORDER BY w.id`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    currentTicketId: r.current_ticket_id,
    busy: r.busy,
    updatedAt: Math.round(Number(r.updated_at)),
    tellerId: r.teller_id || null,
    tellerUsername: r.teller_username || null,
  }));
}

async function nextNumber(
  service: ServiceType,
  client: Pool["connect"] extends (...args: any) => infer R ? R : any,
) {
  // Lock the counter row and reset if day has changed
  const rowRes = await client.query(
    `SELECT next_number, counter_date FROM service_counters WHERE service=$1 FOR UPDATE`,
    [service],
  );
  if (rowRes.rowCount === 0) {
    await client.query(
      `INSERT INTO service_counters (service, next_number, counter_date) VALUES ($1, 1, current_date)`,
      [service],
    );
  } else {
    const counterDate: string | null = rowRes.rows[0].counter_date ?? null;
    const needsReset =
      !counterDate ||
      counterDate !==
        (await (async () => {
          const { rows } = await client.query(`SELECT current_date::text AS d`);
          return rows[0].d as string;
        })());
    if (needsReset) {
      // Reset counter for the new day
      await client.query(
        `UPDATE service_counters SET next_number=1, counter_date=current_date WHERE service=$1`,
        [service],
      );
      // Archive previous-day tickets to avoid conflicts and clear windows
      await client.query(
        `UPDATE tickets
           SET status='done', completed_at = COALESCE(completed_at, now())
         WHERE status IN ('waiting','serving','transferred')
           AND created_at < date_trunc('day', now())`,
      );
      await client.query(
        `UPDATE windows SET current_ticket_id=NULL, busy=false, updated_at=now()`,
      );
    }
  }
  const res = await client.query(
    `UPDATE service_counters SET next_number = next_number + 1 WHERE service=$1 RETURNING next_number;`,
    [service],
  );
  const next = res.rows[0].next_number as number;
  return next - 1;
}

// Global daily counter for unified ticket numbering
async function nextGlobalNumber(
  client: Pool["connect"] extends (...args: any) => infer R ? R : any,
) {
  const rowRes = await client.query(
    `SELECT next_number, counter_date FROM service_counters WHERE service='GLOBAL' FOR UPDATE`,
  );
  try {
    console.log("DBG nextGlobalNumber - before:", rowRes.rows[0] ?? null);
  } catch {}
  if (rowRes.rowCount === 0) {
    await client.query(
      `INSERT INTO service_counters (service, next_number, counter_date) VALUES ('GLOBAL', 1, current_date)`,
    );
  } else {
    const counterDate: string | null = rowRes.rows[0].counter_date ?? null;
    const needsReset =
      !counterDate ||
      counterDate !==
        (await (async () => {
          const { rows } = await client.query(`SELECT current_date::text AS d`);
          return rows[0].d as string;
        })());
    if (needsReset) {
      await client.query(
        `UPDATE service_counters SET next_number=1, counter_date=current_date WHERE service='GLOBAL'`,
      );
      await client.query(
        `UPDATE tickets
           SET status='done', completed_at = COALESCE(completed_at, now())
         WHERE status IN ('waiting','serving','transferred')
           AND created_at < date_trunc('day', now())`,
      );
      await client.query(
        `UPDATE windows SET current_ticket_id=NULL, busy=false, updated_at=now()`,
      );
    }
  }
  const res = await client.query(
    `UPDATE service_counters SET next_number = next_number + 1 WHERE service='GLOBAL' RETURNING next_number;`,
  );
  try {
    console.log("DBG nextGlobalNumber - after:", res.rows[0]);
  } catch {}
  const next = res.rows[0].next_number as number;
  return next - 1;
}

async function checkAndResetExpiredTickets(
  client: any,
): Promise<{ expiredCount: number }> {
  const EXPIRATION_HOURS = 24;
  const expirationThreshold = new Date(
    Date.now() - EXPIRATION_HOURS * 60 * 60 * 1000,
  ).toISOString();

  try {
    // Find tickets older than 24 hours that aren't already marked as done/skipped
    const expiredRes = await client.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE created_at < $1 AND status NOT IN ('done', 'skipped')`,
      [expirationThreshold],
    );
    const expiredCount = Number(expiredRes.rows[0]?.count || 0);

    if (expiredCount > 0) {
      // Mark all expired tickets as done with expiration reason
      await client.query(
        `UPDATE tickets
         SET status='done', completed_at=now(), expired_at=now(),
             remark = CASE WHEN remark IS NULL THEN 'Auto-expired: ticket exceeded 24 hours'
                      ELSE remark || E'\nAuto-expired: ticket exceeded 24 hours' END
         WHERE created_at < $1 AND status NOT IN ('done', 'skipped')`,
        [expirationThreshold],
      );

      // Reset all windows to idle
      await client.query(
        `UPDATE windows SET current_ticket_id=NULL, busy=false, updated_at=now()`,
      );

      // Reset service counters for new day
      await client.query(
        `UPDATE service_counters SET next_number=1, counter_date=current_date WHERE service='GLOBAL'`,
      );
      await client.query(
        `UPDATE service_counters SET next_number=1, counter_date=current_date
         WHERE service != 'GLOBAL'`,
      );

      console.log(
        `✓ Auto-reset triggered: ${expiredCount} tickets expired, queues cleared`,
      );
    }

    return { expiredCount };
  } catch (error) {
    console.error("Error checking expired tickets", error);
    return { expiredCount: 0 };
  }
}

export async function createTicketDb(
  service: ServiceType,
  notes?: string,
  ownerName?: string,
  woreda?: string,
  serviceCategory?: string,
  selectedServices?: string[],
): Promise<Ticket> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Check and reset any expired tickets first
    await checkAndResetExpiredTickets(client);

    // Acquire transaction-level advisory lock to serialize ticket number generation
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [123456789]);

    // Determine the next ticket number for today by inspecting the max number already used today
    const maxRes = await client.query(
      `SELECT MAX(number) AS maxn FROM tickets WHERE created_at >= date_trunc('day', now())`,
    );
    const maxn = Number(maxRes.rows[0]?.maxn || 0);
    const MAX_TICKET_NUMBER = 200;
    if (maxn >= MAX_TICKET_NUMBER) {
      throw new Error("Ticket range exceeded for today");
    }
    const number = maxn + 1;
    const code = formatTicketCode(service, number);
    const id = (await import("node:crypto")).randomUUID();
    const serializedServices = selectedServices
      ? Array.isArray(selectedServices)
        ? JSON.stringify(selectedServices)
        : JSON.stringify([selectedServices])
      : null;

    const { rows } = await client.query(
      `INSERT INTO tickets (id, service, number, code, status, window_id, notes, owner_name, woreda, service_category, selected_services)
       VALUES ($1, $2, $3, $4, 'waiting', NULL, $5, $6, $7, $8, $9)
       RETURNING id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, service_category, selected_services;`,
      [
        id,
        service,
        number,
        code,
        notes ?? null,
        ownerName ?? null,
        woreda ?? null,
        serviceCategory ?? null,
        serializedServices,
      ],
    );
    await client.query("COMMIT");
    const r = rows[0];
    // Debug log to help track counter behavior
    try {
      console.log(
        `DB TICKET CREATED number=${r.number} code=${r.code} service=${r.service}`,
      );
    } catch {}
    return {
      id: r.id,
      service: r.service,
      number: r.number,
      code: r.code,
      status: r.status,
      windowId: r.window_id,
      createdAt: Math.round(Number(r.created_at)),
      notes: r.notes ?? undefined,
      ownerName: r.owner_name ?? undefined,
      woreda: r.woreda ?? undefined,
      serviceCategory: r.service_category ?? undefined,
      selectedServices: Array.isArray(r.selected_services)
        ? r.selected_services
        : typeof r.selected_services === "string"
          ? JSON.parse(r.selected_services)
          : undefined,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function callNextDb(windowId: number, service: ServiceType) {
  // Kept for backward-compat: delegate to FIFO variant but constrain by service
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Lock the window row to serialize calls per window and prevent double assignment
    const wRes = await client.query(
      `SELECT id, current_ticket_id FROM windows WHERE id=$1 FOR UPDATE`,
      [windowId],
    );
    if (!wRes.rowCount) {
      await client.query("ROLLBACK");
      throw new Error("Window not found");
    }
    if (wRes.rows[0].current_ticket_id) {
      await client.query("COMMIT");
      return { window: await getWindow(client, windowId), ticket: null as any };
    }

    const nextRes = await client.query(
      `SELECT id FROM tickets WHERE service=$1 AND status='waiting' ORDER BY created_at, number LIMIT 1 FOR UPDATE SKIP LOCKED;`,
      [service],
    );
    if (!nextRes.rowCount) {
      await client.query("COMMIT");
      return { window: await getWindow(client, windowId), ticket: null as any };
    }
    const ticketId = nextRes.rows[0].id;
    const tRes = await client.query(
      `UPDATE tickets SET status='serving', window_id=$1, started_at=COALESCE(started_at, now()) WHERE id=$2 RETURNING id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda;`,
      [windowId, ticketId],
    );
    await client.query(
      `UPDATE windows SET current_ticket_id=$1, busy=true, updated_at=now() WHERE id=$2`,
      [ticketId, windowId],
    );
    await client.query("COMMIT");
    const ticket = rowToTicket(tRes.rows[0]);
    const window = await getWindow(p, windowId);
    return { window, ticket };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function callNextAnyDb(windowId: number) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Lock the window row first to avoid race conditions assigning two tickets to the same window
    const wRes = await client.query(
      `SELECT id, current_ticket_id FROM windows WHERE id=$1 FOR UPDATE`,
      [windowId],
    );
    if (!wRes.rowCount) {
      await client.query("ROLLBACK");
      throw new Error("Window not found");
    }
    if (wRes.rows[0].current_ticket_id) {
      await client.query("COMMIT");
      return { window: await getWindow(client, windowId), ticket: null as any };
    }

    const nextRes = await client.query(
      `SELECT id FROM tickets WHERE status='waiting' ORDER BY created_at, number LIMIT 1 FOR UPDATE SKIP LOCKED;`,
    );
    if (!nextRes.rowCount) {
      await client.query("COMMIT");
      return { window: await getWindow(client, windowId), ticket: null as any };
    }
    const ticketId = nextRes.rows[0].id;
    const tRes = await client.query(
      `UPDATE tickets SET status='serving', window_id=$1, started_at=COALESCE(started_at, now()) WHERE id=$2 RETURNING id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, service_category, selected_services;`,
      [windowId, ticketId],
    );
    await client.query(
      `UPDATE windows SET current_ticket_id=$1, busy=true, updated_at=now() WHERE id=$2`,
      [ticketId, windowId],
    );
    await client.query("COMMIT");
    const ticket = rowToTicket(tRes.rows[0]);
    const window = await getWindow(p, windowId);
    return { window, ticket };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function clearTicketNotesDb(ticketId: string): Promise<Ticket> {
  const p = getPool();
  const { rows } = await p.query(
    `UPDATE tickets SET notes=NULL WHERE id=$1 RETURNING id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, service_category, selected_services;`,
    [ticketId],
  );
  return rowToTicket(rows[0]);
}

export async function recallDb(windowId: number, reason?: string) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const w = await getWindow(client, windowId);
    if (!w.currentTicketId) {
      await client.query("ROLLBACK");
      return { ticket: null as any, secondRecall: false };
    }

    const remarkBase = `Recalled by window ${windowId} at ${new Date().toISOString()}`;
    const append = reason ? `${remarkBase}. Reason: ${reason}` : remarkBase;

    const tRes = await client.query(
      `UPDATE tickets
         SET remark = CASE WHEN remark IS NULL OR remark='' THEN $2 ELSE remark || E'\n' || $2 END
       WHERE id=$1
       RETURNING id, service, number, code, status, window_id,
                 extract(epoch from created_at)*1000 as created_at,
                 extract(epoch from started_at)*1000 as started_at,
                 extract(epoch from completed_at)*1000 as completed_at,
                 notes, owner_name, woreda, service_category, selected_services, remark, extract(epoch from skipped_at)*1000 as skipped_at, skipped_by_window;`,
      [w.currentTicketId, append],
    );
    await client.query("COMMIT");
    return { ticket: rowToTicket(tRes.rows[0]), secondRecall: false };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function completeDb(windowId: number) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const w = await getWindow(client, windowId);
    if (!w.currentTicketId) throw new Error("No active ticket");
    const tRes = await client.query(
      `UPDATE tickets SET status='done', completed_at=now() WHERE id=$1 RETURNING id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, service_category, selected_services;`,
      [w.currentTicketId],
    );
    await client.query(
      `UPDATE windows SET current_ticket_id=NULL, busy=false, updated_at=now() WHERE id=$1`,
      [windowId],
    );
    await client.query("COMMIT");
    return {
      window: await getWindow(p, windowId),
      ticket: rowToTicket(tRes.rows[0]),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function skipDb(windowId: number, reason?: string) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const w = await getWindow(client, windowId);
    if (!w.currentTicketId) throw new Error("No active ticket");
    const remarkBase = `Skipped by window ${windowId} at ${new Date().toISOString()}`;
    const remark = reason ? `${remarkBase}. Reason: ${reason}` : remarkBase;
    const tRes = await client.query(
      `UPDATE tickets SET status='skipped', skipped_at=now(), skipped_by_window=$2, remark=$3 WHERE id=$1 RETURNING id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, service_category, selected_services, remark, extract(epoch from skipped_at)*1000 as skipped_at, skipped_by_window;`,
      [w.currentTicketId, windowId, remark],
    );
    await client.query(
      `UPDATE windows SET current_ticket_id=NULL, busy=false, updated_at=now() WHERE id=$1`,
      [windowId],
    );
    await client.query("COMMIT");
    return {
      window: await getWindow(p, windowId),
      ticket: rowToTicket(tRes.rows[0]),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

import { TRANSFER_AVAILABILITY_CHECK_SECONDS } from "./sessions";

export async function transferDb(
  windowId: number,
  targetWindowId?: number | null,
  reason?: string,
  targetUserId?: string | null,
) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const source = await getWindow(client, windowId);
    if (!source.currentTicketId) throw new Error("No active ticket");

    let target: WindowState | null = null;
    let transferredToUserId: string | null = null;
    let finalTargetWindowId: number | null = null;

    // Determine the target user and window
    if (targetUserId) {
      // Direct transfer to user (possibly without window assignment)
      transferredToUserId = targetUserId;

      // If a window is also specified, use it; otherwise use null
      if (targetWindowId) {
        target = await getWindow(client, targetWindowId);
        if (target.busy) {
          throw new Error(
            `${target.name} is currently serving and cannot receive transfers`,
          );
        }
        finalTargetWindowId = targetWindowId;
      } else {
        // Employee transfer without window - check if user exists
        const userCheckRes = await client.query(
          `SELECT id, full_name, role, username FROM users WHERE id=$1 LIMIT 1`,
          [targetUserId],
        );

        if (userCheckRes.rowCount === 0) {
          console.error(`[Transfer] User not found: ${targetUserId}`);
          throw new Error(`Target user not found: ${targetUserId}`);
        }

        const targetUser = userCheckRes.rows[0];
        console.log(
          `[Transfer] Found user: id=${targetUser.id}, username=${targetUser.username}, role=${targetUser.role}`,
        );

        // Accept any role except 'admin' and 'reception' (they typically don't handle tickets)
        const restrictedRoles = ["admin", "reception"];
        if (restrictedRoles.includes(targetUser.role)) {
          console.error(
            `[Transfer] Invalid role for user ${targetUser.username}: ${targetUser.role}`,
          );
          throw new Error(
            `Cannot transfer ticket to ${targetUser.username}. User has role "${targetUser.role}" and cannot receive transferred tickets.`,
          );
        }
        // Create a pseudo-window object for response purposes
        target = {
          id: 0,
          name: targetUser.full_name || targetUser.username || "Employee",
          currentTicketId: null,
          busy: false,
          updatedAt: Date.now(),
        };
      }
    } else if (targetWindowId) {
      // Legacy transfer to window
      target = await getWindow(client, targetWindowId);
      if (target.busy) {
        throw new Error(
          `${target.name} is currently serving and cannot receive transfers`,
        );
      }
      finalTargetWindowId = targetWindowId;

      // Get the user assigned to the target window
      const userRes = await client.query(
        `SELECT id FROM users WHERE window_id=$1 AND role='teller' LIMIT 1`,
        [targetWindowId],
      );
      transferredToUserId = userRes.rows[0]?.id || null;
    } else {
      throw new Error("Either targetWindowId or targetUserId must be provided");
    }

    const remarkBase = `Transferred from window ${windowId} at ${new Date().toISOString()}`;
    const remark = reason ? `${remarkBase}. Reason: ${reason}` : remarkBase;

    // Update source window
    await client.query(
      `UPDATE windows SET current_ticket_id=NULL, busy=false, updated_at=now() WHERE id=$1`,
      [windowId],
    );

    // Update target window if it exists
    if (finalTargetWindowId) {
      await client.query(
        `UPDATE windows SET current_ticket_id=$1, busy=true, updated_at=now() WHERE id=$2`,
        [source.currentTicketId, finalTargetWindowId],
      );
    }

    // Update ticket with transfer info
    // Reset started_at and started_by_user_id when transferring to an employee (new start)
    const tRes = await client.query(
      `UPDATE tickets SET status='transferred', window_id=$1, transferred_from_window=$2, transferred_to_window=$3, transferred_to_user_id=$6, transferred_at=now(), started_at=NULL, started_by_user_id=NULL, proceeded_at=NULL, remark=$5 WHERE id=$4 RETURNING id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, service_category, selected_services, transferred_from_window, transferred_to_window, transferred_to_user_id, extract(epoch from transferred_at)*1000 as transferred_at, remark;`,
      [
        finalTargetWindowId || null,
        windowId,
        finalTargetWindowId || null,
        source.currentTicketId,
        remark,
        transferredToUserId,
      ],
    );

    if (tRes.rowCount === 0) {
      throw new Error("Failed to transfer ticket");
    }

    if (finalTargetWindowId) {
      await client.query(
        `INSERT INTO transfer_history (ticket_id, from_window, to_window) VALUES ($1, $2, $3)`,
        [source.currentTicketId, windowId, finalTargetWindowId],
      );
    }

    await client.query("COMMIT");

    const ticket = rowToTicket(tRes.rows[0]);

    // Log successful transfer attempt
    try {
      await logAudit({
        action: "window.transfer",
        windowId: windowId,
        details: {
          sourceWindowId: windowId,
          targetWindowId: finalTargetWindowId || null,
          targetUserId: transferredToUserId || null,
          ticketId: source.currentTicketId,
          ticketCode: ticket?.code ?? null,
          status: "success",
        },
      });
    } catch {}

    return {
      source: await getWindow(p, windowId),
      target: target!,
      ticket,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    // Ensure we have a proper Error object with a message
    if (e instanceof Error) {
      throw e;
    } else if (typeof e === "string") {
      throw new Error(e);
    } else if (typeof e === "object" && e !== null) {
      const err = e as any;
      throw new Error(
        err.message || err.msg || err.detail || JSON.stringify(e),
      );
    } else {
      throw new Error(`Transfer failed: ${String(e)}`);
    }
  } finally {
    client.release();
  }
}

export async function displayStateDb(): Promise<DisplayState> {
  const p = getPool();
  const client = await p.connect();
  try {
    // Check and reset expired tickets before getting display state
    await checkAndResetExpiredTickets(client);
  } catch (error) {
    console.error("Error during expiration check in displayStateDb", error);
  } finally {
    client.release();
  }

  const currentRes = await p.query(
    `SELECT t.id,
            t.service,
            t.code,
            t.status,
            t.window_id,
            extract(epoch from t.created_at)*1000 as created_at,
            extract(epoch from w.updated_at)*1000 as updated_at
       FROM windows w
       JOIN tickets t ON t.id = w.current_ticket_id
       WHERE t.status IN ('serving','transferred')
       ORDER BY w.updated_at DESC
       LIMIT 1`,
  );
  const waitingRes = await p.query(
    `SELECT id,
            service,
            code,
            status,
            window_id,
            extract(epoch from created_at)*1000 as created_at
       FROM tickets
       WHERE status='waiting'
       ORDER BY created_at, number`,
  );

  const mapRow = (row: any): DisplayTicket => ({
    id: row.id,
    code: row.code,
    service: row.service,
    status: row.status,
    windowId: row.window_id ?? null,
    createdAt: Math.round(Number(row.created_at)),
    updatedAt:
      row.updated_at !== undefined && row.updated_at !== null
        ? Math.round(Number(row.updated_at))
        : undefined,
  });

  const current = currentRes.rowCount ? mapRow(currentRes.rows[0]) : null;
  const waitingTickets = waitingRes.rows.map(mapRow);
  const [next, nextAfter, ...rest] = waitingTickets;

  return {
    current,
    next: next ?? null,
    nextAfter: nextAfter ?? null,
    waiting: rest,
  };
}

export async function getTicketByCodeDb(code: string): Promise<{
  ticket: Ticket | null;
  positionInQueue: number | null;
  estimatedWaitSeconds: number | null;
}> {
  const p = getPool();
  console.log("🔎 getTicketByCodeDb - Searching for code:", code);
  const tRes = await p.query(
    `SELECT id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, service_category, selected_services, transferred_from_window, extract(epoch from transferred_at)*1000 as transferred_at
     FROM tickets WHERE code=$1 ORDER BY created_at DESC LIMIT 1`,
    [code],
  );
  console.log("🔎 getTicketByCodeDb - Query result:", {
    code,
    rowCount: tRes.rowCount,
    rows: tRes.rows.slice(0, 1),
  });
  if (!tRes.rowCount)
    return { ticket: null, positionInQueue: null, estimatedWaitSeconds: null };
  const t = rowToTicket(tRes.rows[0]);

  // Check if ticket is older than 24 hours
  const now = Date.now();
  const ticketAge = now - t.createdAt;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  if (ticketAge > TWENTY_FOUR_HOURS) {
    return { ticket: null, positionInQueue: null, estimatedWaitSeconds: null };
  }

  if (t.status !== "waiting")
    return { ticket: t, positionInQueue: null, estimatedWaitSeconds: null };
  const posRes = await p.query(
    `SELECT COUNT(*) AS ahead FROM tickets
     WHERE status='waiting' AND created_at < (SELECT created_at FROM tickets WHERE id=$1)`,
    [t.id],
  );
  const ahead = Number(posRes.rows[0].ahead || 0);
  const position = ahead + 1;
  console.log("📊 getTicketByCodeDb - Position calculation:", {
    code,
    service: t.service,
    ticketId: t.id,
    ahead,
    position,
    posResRowCount: posRes.rowCount,
  });
  const avgRes = await p.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_seconds
     FROM tickets WHERE completed_at IS NOT NULL AND started_at IS NOT NULL`,
  );
  const avg = Math.max(
    60,
    Math.round(Number(avgRes.rows[0]?.avg_seconds || 300)),
  );
  console.log("📊 getTicketByCodeDb - Final result:", {
    code,
    position,
    avg,
    estimatedWaitSeconds: position * avg,
  });
  return {
    ticket: t,
    positionInQueue: position,
    estimatedWaitSeconds: position * avg,
  };
}

export async function enrichSelectedServicesWithNames(
  ticket: Ticket,
): Promise<Ticket> {
  if (
    !ticket.selectedServices ||
    ticket.selectedServices.length === 0 ||
    !ticket.serviceCategory
  ) {
    return ticket;
  }

  try {
    const p = getPool();
    // Fetch the category ID by code
    const catRes = await p.query(
      `SELECT id FROM service_categories WHERE code = $1`,
      [ticket.serviceCategory],
    );

    if (!catRes.rowCount) {
      console.warn(
        `Service category not found: ${ticket.serviceCategory} for ticket ${ticket.id}`,
      );
      return ticket; // Fallback if category not found
    }

    const categoryId = catRes.rows[0].id;

    // Fetch service names for the given IDs
    const servicesRes = await p.query(
      `SELECT id, name FROM services WHERE category_id = $1 AND id = ANY($2)`,
      [categoryId, ticket.selectedServices],
    );

    console.log(
      `[enrichSingleTicket] Ticket ${ticket.id}: category=${ticket.serviceCategory}, categoryId=${categoryId}, serviceIds=${ticket.selectedServices.join(", ")}, found=${servicesRes.rowCount} matches`,
    );

    // Create a map of ID to name
    const idToNameMap = new Map(
      servicesRes.rows.map((r: any) => [r.id, r.name]),
    );

    // Return names in the same order as the IDs
    const enrichedNames = ticket.selectedServices
      .map((id: string) => {
        const name = idToNameMap.get(id);
        if (!name) {
          console.warn(
            `Service ID ${id} not found in category ${ticket.serviceCategory} for ticket ${ticket.id}`,
          );
        }
        return name;
      })
      .filter((name: string | undefined) => name !== undefined) as string[];

    return {
      ...ticket,
      selectedServices:
        enrichedNames.length > 0 ? enrichedNames : ticket.selectedServices,
    };
  } catch (error) {
    console.warn("Error enriching selected services with names:", error);
    return ticket; // Fallback to original if enrichment fails
  }
}

export async function enrichMultipleTicketsWithServiceNames(
  tickets: Ticket[],
): Promise<Ticket[]> {
  if (tickets.length === 0) {
    return tickets;
  }

  try {
    const p = getPool();

    // Group tickets by serviceCategory
    const ticketsByCategory = new Map<string, Ticket[]>();
    for (const ticket of tickets) {
      if (
        ticket.selectedServices &&
        ticket.selectedServices.length > 0 &&
        ticket.serviceCategory
      ) {
        const key = ticket.serviceCategory;
        if (!ticketsByCategory.has(key)) {
          ticketsByCategory.set(key, []);
        }
        ticketsByCategory.get(key)!.push(ticket);
      }
    }

    console.log(
      `[enrichMultipleTickets] Processing ${tickets.length} tickets, ${ticketsByCategory.size} categories with services`,
    );

    // For each category, fetch all service names
    const allServicesByCategory = new Map<string, Map<string, string>>();

    for (const [categoryCode, categoryTickets] of ticketsByCategory) {
      // Fetch the category ID by code
      const catRes = await p.query(
        `SELECT id FROM service_categories WHERE code = $1`,
        [categoryCode],
      );

      if (!catRes.rowCount) {
        console.warn(`Service category not found: ${categoryCode}`);
        continue;
      }

      const categoryId = catRes.rows[0].id;

      // Collect all unique service IDs from this category's tickets
      const serviceIds = new Set<string>();
      for (const ticket of categoryTickets) {
        ticket.selectedServices?.forEach((id: string) => {
          serviceIds.add(id);
        });
      }

      // Fetch all service names for this category
      if (serviceIds.size > 0) {
        const servicesRes = await p.query(
          `SELECT id, name FROM services WHERE category_id = $1 AND id = ANY($2)`,
          [categoryId, Array.from(serviceIds)],
        );

        console.log(
          `[enrichMultipleTickets] Category ${categoryCode}: looking for ${serviceIds.size} services, found ${servicesRes.rowCount} matches`,
        );

        const idToNameMap = new Map(
          servicesRes.rows.map((r: any) => [r.id, r.name]),
        );

        // Log which IDs were not found
        const missingIds = Array.from(serviceIds).filter(
          (id) => !idToNameMap.has(id),
        );
        if (missingIds.length > 0) {
          console.warn(
            `[enrichMultipleTickets] Missing services in ${categoryCode}: ${missingIds.join(", ")}`,
          );
        }

        allServicesByCategory.set(categoryCode, idToNameMap);
      }
    }

    // Enrich all tickets with their service names
    const enrichedTickets = tickets.map((ticket) => {
      if (
        !ticket.selectedServices ||
        ticket.selectedServices.length === 0 ||
        !ticket.serviceCategory
      ) {
        return ticket;
      }

      const idToNameMap = allServicesByCategory.get(ticket.serviceCategory);
      if (!idToNameMap) {
        console.warn(
          `No service names found for category ${ticket.serviceCategory} in ticket ${ticket.id}`,
        );
        return ticket;
      }

      const enrichedNames = ticket.selectedServices
        .map((id: string) => {
          const name = idToNameMap.get(id);
          if (!name) {
            console.warn(
              `Service ID ${id} not found in category ${ticket.serviceCategory} for ticket ${ticket.id}`,
            );
          }
          return name;
        })
        .filter((name: string | undefined) => name !== undefined) as string[];

      return {
        ...ticket,
        selectedServices:
          enrichedNames.length > 0 ? enrichedNames : ticket.selectedServices, // Keep original IDs if enrichment fails
      };
    });

    return enrichedTickets;
  } catch (error) {
    console.warn("Error enriching multiple tickets with service names:", error);
    return tickets; // Fallback to original if enrichment fails
  }
}

function rowToTicket(r: any): Ticket {
  return {
    id: r.id,
    service: r.service,
    number: r.number,
    code: r.code,
    status: r.status,
    windowId: r.window_id,
    createdAt: Math.round(Number(r.created_at)),
    startedAt: r.started_at ? Math.round(Number(r.started_at)) : undefined,
    completedAt: r.completed_at
      ? Math.round(Number(r.completed_at))
      : undefined,
    notes: r.notes ?? undefined,
    ownerName: r.owner_name ?? undefined,
    woreda: r.woreda ?? undefined,
    serviceCategory: r.service_category ?? undefined,
    selectedServices: Array.isArray(r.selected_services)
      ? r.selected_services
      : typeof r.selected_services === "string"
        ? JSON.parse(r.selected_services)
        : undefined,
    remark: r.remark ?? undefined,
    skippedAt: r.skipped_at ? Math.round(Number(r.skipped_at)) : undefined,
    skippedByWindow: r.skipped_by_window ?? undefined,
    transferredFromWindow: r.transferred_from_window ?? undefined,
    transferredToWindow: r.transferred_to_window ?? undefined,
    transferredAt: r.transferred_at
      ? Math.round(Number(r.transferred_at))
      : undefined,
    transferredToUserId: r.transferred_to_user_id ?? undefined,
    expiredAt: r.expired_at ? Math.round(Number(r.expired_at)) : undefined,
  };
}

async function getWindow(clientOrPool: any, id: number): Promise<WindowState> {
  const { rows } = await clientOrPool.query(
    `SELECT id, name, current_ticket_id, busy, extract(epoch from updated_at)*1000 as updated_at FROM windows WHERE id=$1`,
    [id],
  );
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    currentTicketId: r.current_ticket_id,
    busy: r.busy,
    updatedAt: Math.round(Number(r.updated_at)),
  };
}

export async function listServiceCategoriesDb() {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT id, code, name, extract(epoch from created_at)*1000 as created_at, extract(epoch from updated_at)*1000 as updated_at
     FROM service_categories ORDER BY display_order, created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    createdAt: Math.round(Number(r.created_at)),
    updatedAt: Math.round(Number(r.updated_at)),
  }));
}

export async function getServicesByCategoryDb(categoryId: string) {
  const p = getPool();
  // Query by code first (what frontend sends), then by UUID if needed
  const { rows: catRows } = await p.query(
    `SELECT id, code, name FROM service_categories WHERE code=$1 OR id::text=$1`,
    [categoryId],
  );

  if (!catRows.length) {
    throw new Error("Category not found");
  }

  const category = catRows[0];
  const { rows: serviceRows } = await p.query(
    `SELECT id, category_id, code, name, extract(epoch from created_at)*1000 as created_at, extract(epoch from updated_at)*1000 as updated_at
     FROM services WHERE category_id=$1 ORDER BY display_order, created_at`,
    [category.id],
  );

  return {
    categoryId: category.id,
    categoryName: category.name,
    services: serviceRows.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      code: r.code,
      name: r.name,
      createdAt: Math.round(Number(r.created_at)),
      updatedAt: Math.round(Number(r.updated_at)),
    })),
  };
}

export async function createServiceCategoryDb(params: {
  code: string;
  name: string;
}): Promise<{
  id: string;
  code: string;
  name: string;
}> {
  const p = getPool();
  const { rows } = await p.query(
    `INSERT INTO service_categories (id, code, name)
     VALUES (gen_random_uuid(), $1, $2)
     RETURNING id, code, name`,
    [params.code, params.name],
  );

  if (!rows.length) {
    throw new Error("Failed to create category");
  }

  return rows[0];
}

export async function updateServiceCategoryDb(
  categoryId: string,
  params: { code?: string; name?: string },
): Promise<{ id: string; code: string; name: string }> {
  const p = getPool();
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (params.code) {
    updates.push(`code = $${paramCount}`);
    values.push(params.code);
    paramCount++;
  }

  if (params.name) {
    updates.push(`name = $${paramCount}`);
    values.push(params.name);
    paramCount++;
  }

  if (updates.length === 0) {
    throw new Error("No fields to update");
  }

  updates.push(`updated_at = now()`);
  values.push(categoryId);

  const { rows } = await p.query(
    `UPDATE service_categories SET ${updates.join(", ")} WHERE id = $${paramCount}
     RETURNING id, code, name`,
    values,
  );

  if (!rows.length) {
    throw new Error("Category not found");
  }

  return rows[0];
}

export async function deleteServiceCategoryDb(
  categoryId: string,
): Promise<void> {
  const p = getPool();
  const { rowCount } = await p.query(
    `DELETE FROM service_categories WHERE id = $1`,
    [categoryId],
  );

  if (!rowCount) {
    throw new Error("Category not found");
  }
}

export async function createServiceDb(params: {
  categoryId: string;
  code: string;
  name: string;
}): Promise<{
  id: string;
  categoryId: string;
  code: string;
  name: string;
}> {
  const p = getPool();
  const { rows } = await p.query(
    `INSERT INTO services (id, category_id, code, name)
     VALUES (gen_random_uuid(), $1, $2, $3)
     RETURNING id, category_id, code, name`,
    [params.categoryId, params.code, params.name],
  );

  if (!rows.length) {
    throw new Error("Failed to create service");
  }

  return {
    id: rows[0].id,
    categoryId: rows[0].category_id,
    code: rows[0].code,
    name: rows[0].name,
  };
}

export async function updateServiceDb(
  serviceId: string,
  params: { code?: string; name?: string },
): Promise<{
  id: string;
  categoryId: string;
  code: string;
  name: string;
}> {
  const p = getPool();
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (params.code) {
    updates.push(`code = $${paramCount}`);
    values.push(params.code);
    paramCount++;
  }

  if (params.name) {
    updates.push(`name = $${paramCount}`);
    values.push(params.name);
    paramCount++;
  }

  if (updates.length === 0) {
    throw new Error("No fields to update");
  }

  updates.push(`updated_at = now()`);
  values.push(serviceId);

  const { rows } = await p.query(
    `UPDATE services SET ${updates.join(", ")} WHERE id = $${paramCount}
     RETURNING id, category_id, code, name`,
    values,
  );

  if (!rows.length) {
    throw new Error("Service not found");
  }

  return {
    id: rows[0].id,
    categoryId: rows[0].category_id,
    code: rows[0].code,
    name: rows[0].name,
  };
}

export async function deleteServiceDb(serviceId: string): Promise<void> {
  const p = getPool();
  const { rowCount } = await p.query(`DELETE FROM services WHERE id = $1`, [
    serviceId,
  ]);

  if (!rowCount) {
    throw new Error("Service not found");
  }
}

export async function listJobTitles() {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT id, name_amharic, name_english, display_order, extract(epoch from created_at)*1000 as created_at, extract(epoch from updated_at)*1000 as updated_at
     FROM job_title ORDER BY display_order, created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    nameAmharic: r.name_amharic,
    nameEnglish: r.name_english,
    displayOrder: r.display_order,
    createdAt: Math.round(Number(r.created_at)),
    updatedAt: Math.round(Number(r.updated_at)),
  }));
}

export async function getUserByUsername(username: string): Promise<{
  id: string;
  username: string;
  password_hash: string;
  role: "reception" | "teller" | "admin" | "employee";
  window_id: number | null;
  disabled?: boolean | null;
  full_name?: string | null;
} | null> {
  try {
    const { rows } = await getPool().query(
      `SELECT id, username, password_hash, role, window_id, disabled, full_name FROM users WHERE username=$1 LIMIT 1`,
      [username],
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

export async function getUserByWindow(windowId: number): Promise<{
  id: string;
  username: string;
  password_hash: string;
  role: "reception" | "teller" | "admin" | "employee";
  window_id: number | null;
  disabled?: boolean | null;
  full_name?: string | null;
} | null> {
  try {
    const { rows } = await getPool().query(
      `SELECT id, username, password_hash, role, window_id, disabled, full_name FROM users WHERE window_id=$1 LIMIT 1`,
      [windowId],
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

export async function createUser(params: {
  username: string;
  password_hash: string;
  role: "reception" | "teller" | "admin" | "employee";
  window_id?: number | null;
  disabled?: boolean | null;
  job_title_id?: string | null;
}): Promise<void> {
  try {
    const p = getPool();
    await p.query(
      `INSERT INTO users (id, username, password_hash, role, window_id, disabled, job_title_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [
        params.username,
        params.password_hash,
        params.role,
        params.window_id ?? null,
        params.disabled ?? false,
        params.job_title_id ?? null,
      ],
    );
  } catch (error) {
    throw error;
  }
}

// Demo user creation functions have been removed
// Users must be created explicitly through the management API

export async function logAudit(params: {
  action: string;
  userId?: string | null;
  username?: string | null;
  role?: string | null;
  windowId?: number | null;
  details?: any;
}) {
  if (!isDbEnabled) {
    try {
      // eslint-disable-next-line no-console
      console.log("AUDIT", {
        at: new Date().toISOString(),
        ...params,
      });
    } catch {}
    return;
  }
  try {
    const p = getPool();
    await p.query(
      `INSERT INTO audit_logs (action, user_id, username, role, window_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.action,
        params.userId ?? null,
        params.username ?? null,
        params.role ?? null,
        params.windowId ?? null,
        params.details ? JSON.stringify(params.details) : null,
      ],
    );
  } catch (error) {
    console.error("Error logging audit:", error);
  }
}

// Get allowed service categories for a window
export async function getWindowServicesDb(windowId: number): Promise<string[]> {
  const p = getPool();
  const { rows } = await p.query(
    `SELECT service_category_code FROM window_services WHERE window_id=$1 ORDER BY service_category_code`,
    [windowId],
  );
  return rows.map((r) => r.service_category_code);
}

// Set allowed service categories for a window
export async function setWindowServicesDb(
  windowId: number,
  serviceCategories: string[],
): Promise<string[]> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Delete existing mappings for this window
    await client.query(`DELETE FROM window_services WHERE window_id=$1`, [
      windowId,
    ]);

    // Insert new mappings
    for (const category of serviceCategories) {
      await client.query(
        `INSERT INTO window_services (window_id, service_category_code) VALUES ($1, $2)`,
        [windowId, category],
      );
    }

    await client.query("COMMIT");
    return serviceCategories;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Modified callNextDb to accept window ID and automatically select from allowed services
export async function callNextForWindowDb(windowId: number) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Lock the window row to serialize calls per window and prevent double assignment
    const wRes = await client.query(
      `SELECT id, current_ticket_id FROM windows WHERE id=$1 FOR UPDATE`,
      [windowId],
    );
    if (!wRes.rowCount) {
      await client.query("ROLLBACK");
      throw new Error("Window not found");
    }
    if (wRes.rows[0].current_ticket_id) {
      await client.query("COMMIT");
      return { window: await getWindow(client, windowId), ticket: null as any };
    }

    // Get allowed service categories for this window
    const catRes = await client.query(
      `SELECT service_category_code FROM window_services WHERE window_id=$1`,
      [windowId],
    );
    const allowedCategories = catRes.rows.map((r) => r.service_category_code);

    // If no service restrictions, use global FIFO
    if (allowedCategories.length === 0) {
      const nextRes = await client.query(
        `SELECT id FROM tickets WHERE status='waiting' ORDER BY created_at, number LIMIT 1 FOR UPDATE SKIP LOCKED;`,
      );
      if (!nextRes.rowCount) {
        await client.query("COMMIT");
        return {
          window: await getWindow(client, windowId),
          ticket: null as any,
        };
      }
      const ticketId = nextRes.rows[0].id;
      const tRes = await client.query(
        `UPDATE tickets SET status='serving', window_id=$1, started_at=COALESCE(started_at, now()) WHERE id=$2 RETURNING id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, service_category, selected_services;`,
        [windowId, ticketId],
      );
      await client.query(
        `UPDATE windows SET current_ticket_id=$1, busy=true, updated_at=now() WHERE id=$2`,
        [ticketId, windowId],
      );
      await client.query("COMMIT");
      const ticket = rowToTicket(tRes.rows[0]);
      const window = await getWindow(p, windowId);
      return { window, ticket };
    }

    // Select next ticket from allowed service categories, maintaining FIFO
    const placeholders = allowedCategories.map((_, i) => `$${i + 1}`).join(",");
    const nextRes = await client.query(
      `SELECT id FROM tickets WHERE service_category IN (${placeholders}) AND status='waiting' ORDER BY created_at, number LIMIT 1 FOR UPDATE SKIP LOCKED;`,
      allowedCategories,
    );
    if (!nextRes.rowCount) {
      await client.query("COMMIT");
      return { window: await getWindow(client, windowId), ticket: null as any };
    }
    const ticketId = nextRes.rows[0].id;
    const tRes = await client.query(
      `UPDATE tickets SET status='serving', window_id=$1, started_at=COALESCE(started_at, now()) WHERE id=$2 RETURNING id, service, number, code, status, window_id, extract(epoch from created_at)*1000 as created_at, extract(epoch from started_at)*1000 as started_at, extract(epoch from completed_at)*1000 as completed_at, notes, owner_name, woreda, service_category, selected_services;`,
      [windowId, ticketId],
    );
    await client.query(
      `UPDATE windows SET current_ticket_id=$1, busy=true, updated_at=now() WHERE id=$2`,
      [ticketId, windowId],
    );
    await client.query("COMMIT");
    const ticket = rowToTicket(tRes.rows[0]);
    const window = await getWindow(p, windowId);
    return { window, ticket };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// initialize on import (non-blocking with timeout)
const initDbWithTimeout = async () => {
  const ms =
    Number(process.env.DB_INIT_TIMEOUT_MS) > 0
      ? Number(process.env.DB_INIT_TIMEOUT_MS)
      : 900000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            `Database initialization timeout after ${Math.round(ms / 1000)}s`,
          ),
        ),
      ms,
    ),
  );
  try {
    console.log("🔄 Database initialization started...");
    await Promise.race([initDb(), timeoutPromise]);
    console.log(
      "✅ Database initialization complete. No demo users created - users must be added through the management API.",
    );
  } catch (e) {
    console.error("❌ DB init failed:", e instanceof Error ? e.message : e);
  }
};

// Start initialization but don't block server startup
initDbWithTimeout().catch((err) => {
  console.error("❌ Uncaught DB init error:", err);
});

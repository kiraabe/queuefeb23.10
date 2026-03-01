import { LicenseConfig } from "@shared/api";
import { getLicenseByKeyDb, getPrimaryLicenseDb, LicenseRecord } from "../store/db";

export interface LicenseValidationResult {
  valid: boolean;
  message: string;
  licensee?: string;
}

/**
 * Validates a license key
 *
 * Checks against the database first, then falls back to environment variables.
 * Returns validation result with:
 * - valid: whether the license is valid
 * - message: human-readable message
 * - licensee: name of the licensee (if valid)
 */
export async function validateLicense(host: string, licenseKey?: string): Promise<LicenseValidationResult> {
  const { updateLicenseHostDb, getLicenseByKeyDb, getPrimaryLicenseDb, createLicenseDb } = await import("../store/db");

  const envLicenseKey = process.env.LICENSE_KEY;
  const envLicensee = process.env.LICENSEE || "Licensed User";

  // 1. First, check for an existing activation in the database
  try {
    const dbLicense = await getPrimaryLicenseDb();
    if (dbLicense) {
      // If we have an active license in DB bound to this host, we check if it matches the environment key
      if (dbLicense.status === 'active' && dbLicense.activatedHost === host) {
        // Requirement: env = db = locked app key
        // If an environment key is set, it must match what's in the database
        if (envLicenseKey && envLicenseKey.trim().length > 0) {
          if (dbLicense.licenseKey === envLicenseKey) {
            // Matches! Check expiration
            if (dbLicense.expiresAt && Date.now() > dbLicense.expiresAt) {
              return { valid: false, message: "License has expired" };
            }
            return {
              valid: true,
              message: `Licensed to ${dbLicense.licensee}`,
              licensee: dbLicense.licensee,
            };
          }
          // If they don't match, we fall through to the lock logic below
          console.warn(`[License] Database license key mismatch with environment. App will remain locked.`);
        } else {
          // No environment key constraint, accept the DB license
          if (dbLicense.expiresAt && Date.now() > dbLicense.expiresAt) {
            return { valid: false, message: "License has expired" };
          }
          return {
            valid: true,
            message: `Licensed to ${dbLicense.licensee}`,
            licensee: dbLicense.licensee,
          };
        }
      }
    }
  } catch (error) {
    console.warn("[License] Status check failed:", error);
  }

  // 2. If not activated in DB (status check - no key provided)
  if (!licenseKey) {
    // Application is locked. Even if we have an environment key, we ask for it on the first run.
    const message = envLicenseKey && envLicenseKey.trim().length > 0
      ? "Application is locked. Please enter the key from your environment configuration to activate."
      : "Application is locked. Please enter your license key to activate this server.";

    return {
      valid: false,
      message,
    };
  }

  // 3. Activation attempt (key provided)
  // Cross check with environment key if configured
  if (envLicenseKey && envLicenseKey.trim().length > 0) {
    if (licenseKey === envLicenseKey) {
      try {
        let dbLicense = await getLicenseByKeyDb(licenseKey);
        if (!dbLicense) {
          // One-time save to database to make it a "permanent permit"
          dbLicense = await createLicenseDb(licenseKey, envLicensee);
          console.log(`[License] Environment key saved to database for permanent activation`);
        }

        // Host Binding
        if (!dbLicense.activatedHost) {
          // Bind this server's host/domain
          await updateLicenseHostDb(dbLicense.id, host);
          console.log(`[License] Key activated and bound to server host: ${host}`);
        } else if (dbLicense.activatedHost !== host) {
          console.warn(`[License] Host mismatch. Key activated on ${dbLicense.activatedHost}, tried on ${host}`);
          return {
            valid: false,
            message: "This license is already activated on another server installation. Please contact support.",
          };
        }

        return {
          valid: true,
          message: `Licensed to ${dbLicense.licensee} (Activated)`,
          licensee: dbLicense.licensee,
        };
      } catch (error) {
        console.error("[License] Activation failed:", error);
      }
    } else {
      return {
        valid: false,
        message: "The provided key does not match the server configuration.",
      };
    }
  }

  // Case 4: Fallback for generic keys (only if no environment key is set)
  if (!envLicenseKey || envLicenseKey.trim().length === 0) {
    try {
      const dbLicense = await getLicenseByKeyDb(licenseKey);
      if (dbLicense) {
        // ... same logic as before for generic keys ...
        if (dbLicense.status !== 'active') {
          return { valid: false, message: `License is ${dbLicense.status}` };
        }
        if (dbLicense.expiresAt && Date.now() > dbLicense.expiresAt) {
          return { valid: false, message: "License has expired" };
        }
        if (!dbLicense.activatedHost) {
          await updateLicenseHostDb(dbLicense.id, host);
        } else if (dbLicense.activatedHost !== host) {
          return { valid: false, message: "License bound to another host." };
        }
        return {
          valid: true,
          message: `Licensed to ${dbLicense.licensee}`,
          licensee: dbLicense.licensee,
        };
      }
    } catch (e) {}
  }

  return {
    valid: false,
    message: "Invalid license key. Please check your entry or contact your administrator.",
  };
}

/**
 * Gets the currently configured license info (for admin purposes)
 * Returns the license record from database
 */
export async function getLicenseInfo(): Promise<LicenseConfig | null> {
  // Try database first to get the primary active license
  try {
    const dbLicense = await getPrimaryLicenseDb();
    if (dbLicense) {
      return {
        licenseKey: dbLicense.licenseKey,
        licensee: dbLicense.licensee,
        expiresAt: dbLicense.expiresAt || undefined,
      };
    }
  } catch (error) {
    console.warn("[License] Failed to get primary license from DB:", error);
  }

  return null;
}

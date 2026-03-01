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
/**
 * Validates a license key
 *
 * Checks all three must match to bypass: Entered Key == Environment Key == Database Key
 * Once activated and bound to the host, it bypasses permanently.
 *
 * @param host - The current server host/domain
 * @param licenseKey - The key entered by the user (if any)
 */
export async function validateLicense(host: string, licenseKey?: string): Promise<LicenseValidationResult> {
  const { updateLicenseHostDb, getLicenseByKeyDb, getPrimaryLicenseDb } = await import("../store/db");

  const envLicenseKey = (process.env.LICENSE_KEY || "").trim();

  // If environment variable is missing, we cannot perform the triple-check
  if (!envLicenseKey) {
    return {
      valid: false,
      message: "License environment variable (LICENSE_KEY) is not configured.",
    };
  }

  // 1. Permanent Bypass Check (Status Check)
  // If no key provided, check if we already have a valid activation in the DB that matches the Env
  if (!licenseKey) {
    try {
      // Look for a license that matches the env key AND is bound to this host
      const dbLicense = await getLicenseByKeyDb(envLicenseKey);

      if (dbLicense && dbLicense.status === 'active' && dbLicense.activatedHost === host) {
        // Check expiration
        if (dbLicense.expiresAt && Date.now() > dbLicense.expiresAt) {
          return { valid: false, message: "The activated license has expired." };
        }
        return {
          valid: true,
          message: `Licensed to ${dbLicense.licensee}`,
          licensee: dbLicense.licensee,
        };
      }
    } catch (error) {
      console.warn("[License] Bypass check failed:", error);
    }

    // App is locked - needs initial manual entry of the Env key
    return {
      valid: false,
      message: "Application is locked. Please enter the configured license key to activate.",
    };
  }

  // 2. Manual Activation (User provided a key on lock screen)
  // TRIPLE CHECK: Entered Key == Env Key == DB Key
  if (licenseKey !== envLicenseKey) {
    return {
      valid: false,
      message: "The provided key does not match the server configuration environment variable.",
    };
  }

  try {
    // Check if the key exists in the database (Pre-created by admin)
    const dbLicense = await getLicenseByKeyDb(licenseKey);

    if (dbLicense) {
      // Check status and expiration in DB
      if (dbLicense.status !== 'active') {
        return { valid: false, message: `The license in the database is currently ${dbLicense.status}.` };
      }
      if (dbLicense.expiresAt && Date.now() > dbLicense.expiresAt) {
        return { valid: false, message: "The license in the database has expired." };
      }

      // Host Binding - Save this host to the DB for the permanent bypass
      if (!dbLicense.activatedHost) {
        await updateLicenseHostDb(dbLicense.id, host);
        console.log(`[License] Initial activation: Key bound to host ${host}`);
      } else if (dbLicense.activatedHost !== host) {
        return {
          valid: false,
          message: "This license is already bound to another server installation in the database.",
        };
      }

      // Success! All three match and are now bound to host
      return {
        valid: true,
        message: `Licensed to ${dbLicense.licensee} (Permanent Bypass Activated)`,
        licensee: dbLicense.licensee,
      };
    } else {
      // Key matches Env, but not found in DB
      return {
        valid: false,
        message: "The environment key was not found in the database. Please ensure the admin has added it.",
      };
    }
  } catch (error) {
    console.error("[License] Activation error:", error);
    return {
      valid: false,
      message: "Database error during activation. Please try again.",
    };
  }
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

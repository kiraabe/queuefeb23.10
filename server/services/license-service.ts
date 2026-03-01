import { LicenseConfig, LicenseErrorCode } from "@shared/api";
import { getLicenseByKeyDb, getPrimaryLicenseDb, updateLicenseHostDb, LicenseRecord } from "../store/db";

export interface LicenseValidationResult {
  valid: boolean;
  message: string;
  errorCode?: LicenseErrorCode;
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
      message: "License verification failed.",
      errorCode: "LICENSE_CONFIG_MISSING",
    };
  }

  // Always require manual entry - no automatic bypass
  // User must enter the license key to proceed
  if (!licenseKey) {
    return {
      valid: false,
      message: "Enter your license key to activate the application.",
      errorCode: "LICENSE_NOT_PROVIDED",
    };
  }

  // Manual Activation (User provided a key on lock screen)
  // TRIPLE CHECK: Entered Key == Env Key == DB Key (all three must match)
  if (licenseKey !== envLicenseKey) {
    return {
      valid: false,
      message: "Invalid license key provided.",
      errorCode: "LICENSE_MISMATCH",
    };
  }

  try {
    // Check if the key exists in the database (Pre-created by admin)
    const dbLicense = await getLicenseByKeyDb(licenseKey);
    console.log(`[License] Database lookup for key ${licenseKey}:`, dbLicense ? "Found" : "Not found");

    if (dbLicense) {
      console.log(`[License] License status: ${dbLicense.status}, expires: ${dbLicense.expiresAt}, host: ${dbLicense.activatedHost}`);
      // Check status and expiration in DB
      if (dbLicense.status !== 'active') {
        return {
          valid: false,
          message: "License is not active.",
          errorCode: "LICENSE_INVALID_STATUS",
        };
      }
      if (dbLicense.expiresAt && Date.now() > dbLicense.expiresAt) {
        return {
          valid: false,
          message: "License has expired.",
          errorCode: "LICENSE_EXPIRED",
        };
      }

      // Host Binding - Save this host to the DB for the permanent bypass
      if (!dbLicense.activatedHost) {
        await updateLicenseHostDb(dbLicense.id, host);
        console.log(`[License] Initial activation: Key bound to host ${host}`);
      } else if (dbLicense.activatedHost !== host) {
        return {
          valid: false,
          message: "License is bound to a different server installation.",
          errorCode: "LICENSE_HOST_MISMATCH",
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
        message: "License verification failed.",
        errorCode: "LICENSE_NOT_FOUND",
      };
    }
  } catch (error) {
    console.error("[License] Activation error:", error);
    return {
      valid: false,
      message: "License verification failed.",
      errorCode: "LICENSE_DB_ERROR",
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

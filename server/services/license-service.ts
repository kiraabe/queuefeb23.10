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
  const { updateLicenseHostDb, getLicenseByKeyDb, getPrimaryLicenseDb } = await import("../store/db");

  // Case 1: Checking existing server-wide activation (no key provided)
  if (!licenseKey) {
    try {
      const dbLicense = await getPrimaryLicenseDb();
      if (dbLicense) {
        // If the server has a primary license, check if it's bound to THIS host
        if (dbLicense.status === 'active' && dbLicense.activatedHost === host) {
          // Verify expiration
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
    } catch (error) {
      console.warn("[License] Status check failed:", error);
    }
    return {
      valid: false,
      message: "Application is locked. Please enter your license key to activate this server.",
    };
  }

  // Case 2: New activation attempt (key provided)
  try {
    const dbLicense = await getLicenseByKeyDb(licenseKey);

    if (dbLicense) {
      // Check status
      if (dbLicense.status !== 'active') {
        return { valid: false, message: `License is ${dbLicense.status}` };
      }

      // Check expiration
      if (dbLicense.expiresAt && Date.now() > dbLicense.expiresAt) {
        return { valid: false, message: "License has expired" };
      }

      // Host Binding (Server instance lock)
      if (!dbLicense.activatedHost) {
        // First time activation on a server - bind this server's host/domain
        await updateLicenseHostDb(dbLicense.id, host);
        console.log(`[License] Key ${licenseKey.substring(0, 8)}... bound to server host: ${host}`);
      } else if (dbLicense.activatedHost !== host) {
        // Already bound to a DIFFERENT server/installation
        console.warn(`[License] Host mismatch. Key activated on ${dbLicense.activatedHost}, tried on ${host}`);
        return {
          valid: false,
          message: "This license is already activated on another server installation. Please contact support.",
        };
      }

      // Success
      return {
        valid: true,
        message: `Licensed to ${dbLicense.licensee} (Server Activated)`,
        licensee: dbLicense.licensee,
      };
    }
  } catch (error) {
    console.warn("[License] Activation failed:", error);
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

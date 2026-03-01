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
export async function validateLicense(licenseKey: string, machineId: string): Promise<LicenseValidationResult> {
  // Try database first
  try {
    const { updateLicenseMachineIdDb } = await import("../store/db");
    const dbLicense = await getLicenseByKeyDb(licenseKey);

    if (dbLicense) {
      // Check license status
      if (dbLicense.status !== 'active') {
        return {
          valid: false,
          message: `License is ${dbLicense.status}`,
        };
      }

      // Check expiration
      if (dbLicense.expiresAt && Date.now() > dbLicense.expiresAt) {
        return {
          valid: false,
          message: "License has expired",
        };
      }

      // Machine ID Binding
      if (!dbLicense.activatedMachineId) {
        // First time activation - bind machine ID
        await updateLicenseMachineIdDb(dbLicense.id, machineId);
      } else if (dbLicense.activatedMachineId !== machineId) {
        // Already bound to another machine
        console.warn(`[License] Machine ID mismatch for key ${licenseKey.substring(0, 8)}... Expected: ${dbLicense.activatedMachineId}, Got: ${machineId}`);
        return {
          valid: false,
          message: "This license key is already activated on another device. Please contact support.",
        };
      }

      // Valid license
      return {
        valid: true,
        message: `Licensed to ${dbLicense.licensee} (Verified)`,
        licensee: dbLicense.licensee,
      };
    }
  } catch (error) {
    console.warn("[License] Database lookup failed:", error);
  }

  // If no license is found in DB, or key doesn't match, reject access
  // The environment variable fallback has been removed to enforce database-only validation
  const isKeyProvided = !!licenseKey && licenseKey.trim().length > 0;

  console.warn(`[License] Access restricted. DB validation failed. Key provided: ${isKeyProvided}`);

  return {
    valid: false,
    message: isKeyProvided
      ? "Invalid license key. Please check your key or contact your administrator."
      : "No license key found. Please enter your license key.",
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

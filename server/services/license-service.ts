import { LicenseConfig } from "@shared/api";
import { getLicenseByKeyDb, LicenseRecord } from "../store/db";

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
export async function validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
  // Try database first
  try {
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

      // Valid license
      return {
        valid: true,
        message: `Licensed to ${dbLicense.licensee}`,
        licensee: dbLicense.licensee,
      };
    }
  } catch (error) {
    console.warn("[License] Database lookup failed:", error);
    // Continue to env var fallback
  }

  // Fallback to environment variables (for backwards compatibility)
  const envLicenseKey = process.env.LICENSE_KEY;
  const envLicensee = process.env.LICENSEE || "Environment License";

  if (envLicenseKey) {
    // Check if license key matches (case-insensitive and trimmed)
    if (licenseKey.trim().toLowerCase() === envLicenseKey.trim().toLowerCase()) {
      // Check if license has expired
      const expiresAt = process.env.LICENSE_EXPIRES_AT
        ? parseInt(process.env.LICENSE_EXPIRES_AT, 10)
        : null;

      if (expiresAt && Date.now() > expiresAt) {
        return {
          valid: false,
          message: "License has expired",
        };
      }

      return {
        valid: true,
        message: `Licensed to ${envLicensee}`,
        licensee: envLicensee,
      };
    }
  }

  // If no license is configured, or key doesn't match, reject access
  const isKeyProvided = !!licenseKey && licenseKey.trim().length > 0;

  console.warn(`[License] Access restricted. Key provided: ${isKeyProvided}`);

  return {
    valid: false,
    message: isKeyProvided
      ? "Invalid license key. Please check your key and try again."
      : "No license key found. Please enter your license key.",
  };
}

/**
 * Gets the currently configured license info (for admin purposes)
 * Returns the license record from database or env vars
 */
export async function getLicenseInfo(): Promise<LicenseConfig | null> {
  // Try database first
  try {
    // Since we don't have a way to get "current" license from DB without a key,
    // we'll just check env vars for now
    // In future, you could store a "primary" or "current" license in the DB
  } catch (error) {
    console.warn("[License] Failed to get license info:", error);
  }

  const licenseKey = process.env.LICENSE_KEY;
  const licensee = process.env.LICENSEE;

  if (!licenseKey || !licensee) {
    return null;
  }

  return {
    licenseKey,
    licensee,
    expiresAt: process.env.LICENSE_EXPIRES_AT
      ? parseInt(process.env.LICENSE_EXPIRES_AT, 10)
      : undefined,
  };
}

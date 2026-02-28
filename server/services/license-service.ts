import { LicenseConfig } from "@shared/api";

/**
 * License configuration for this deployment
 * 
 * In production, this should be loaded from:
 * - Environment variables (LICENSE_KEY, LICENSEE)
 * - Configuration files
 * - A remote license server
 * 
 * For now, we'll use environment variables.
 */
function getLicenseConfig(): LicenseConfig | null {
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

export interface LicenseValidationResult {
  valid: boolean;
  message: string;
  licensee?: string;
}

/**
 * Validates a license key
 * 
 * Returns validation result with:
 * - valid: whether the license is valid
 * - message: human-readable message
 * - licensee: name of the licensee (if valid)
 */
export function validateLicense(licenseKey: string): LicenseValidationResult {
  const config = getLicenseConfig();

  // If no license is configured, allow access (development mode)
  if (!config) {
    console.warn("[License] No license configured - running in development mode");
    return {
      valid: true,
      message: "Running in development mode (no license required)",
      licensee: "Development",
    };
  }

  // Check if license key matches
  if (licenseKey !== config.licenseKey) {
    return {
      valid: false,
      message: "Invalid license key",
    };
  }

  // Check if license has expired
  if (config.expiresAt && Date.now() > config.expiresAt) {
    return {
      valid: false,
      message: "License has expired",
    };
  }

  return {
    valid: true,
    message: `Licensed to ${config.licensee}`,
    licensee: config.licensee,
  };
}

/**
 * Gets the currently configured license info (for admin purposes)
 * Returns null if no license is configured
 */
export function getLicenseInfo(): LicenseConfig | null {
  return getLicenseConfig();
}

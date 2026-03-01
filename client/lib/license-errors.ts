import { LicenseErrorCode } from "@shared/api";

/**
 * User-friendly error messages for license error codes
 * Keeps sensitive information server-side while providing clear feedback
 */
const LICENSE_ERROR_MESSAGES: Record<LicenseErrorCode, string> = {
  LICENSE_CONFIG_MISSING: "Server configuration error. Please contact support.",
  LICENSE_NOT_PROVIDED: "Please enter your license key to activate this application.",
  LICENSE_MISMATCH: "The license key you entered is invalid. Please check and try again.",
  LICENSE_NOT_FOUND: "License verification failed. Please contact support.",
  LICENSE_INVALID_STATUS: "Your license is currently inactive. Please contact support.",
  LICENSE_EXPIRED: "Your license has expired. Please renew it to continue.",
  LICENSE_HOST_MISMATCH: "This license is registered to a different server. Please contact support.",
  LICENSE_DB_ERROR: "Unable to verify license at this moment. Please try again.",
};

/**
 * Get a user-friendly error message for a license error code
 * Falls back to generic message if code is unknown
 */
export function getLicenseErrorMessage(
  errorCode?: LicenseErrorCode,
  fallbackMessage?: string
): string {
  if (!errorCode) {
    return fallbackMessage || "License verification failed. Please try again.";
  }

  return LICENSE_ERROR_MESSAGES[errorCode] || fallbackMessage || "An error occurred during license verification.";
}

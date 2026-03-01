import { LicenseErrorCode } from "@shared/api";

/**
 * User-friendly error messages for license error codes
 * Keeps sensitive information server-side while providing clear feedback
 */
const LICENSE_ERROR_MESSAGES: Record<LicenseErrorCode, string> = {
  LICENSE_CONFIG_MISSING: "Server configuration error. Please contact support.",
  LICENSE_NOT_PROVIDED: "Enter your license key to activate the application.",
  LICENSE_MISMATCH: "This license key is not valid. Please check and try again.",
  LICENSE_NOT_FOUND: "This license key was not found. Please check and try again.",
  LICENSE_INVALID_STATUS: "This license is not active. Please contact support.",
  LICENSE_EXPIRED: "This license has expired. Please renew to continue using the application.",
  LICENSE_HOST_MISMATCH: "This license is bound to a different server. Please contact support.",
  LICENSE_DB_ERROR: "Unable to verify license. Please try again.",
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

import { useEffect, useState, useCallback } from "react";
import { ValidateLicenseResponse } from "@shared/api";

interface LicenseState {
  isLoading: boolean;
  isValid: boolean | null;
  message: string;
  licensee?: string;
}

/**
 * Hook to validate the license key
 * 
 * Gets the license key from:
 * 1. localStorage (LICENSE_KEY)
 * 2. Environment variable (VITE_LICENSE_KEY)
 * 
 * The hook validates the license both client-side (quick check)
 * and server-side (secure verification)
 */
export function useLicense(): LicenseState {
  const [state, setState] = useState<LicenseState>({
    isLoading: true,
    isValid: null,
    message: "Validating license...",
  });

  const validateLicense = useCallback(async () => {
    try {
      // Get license key from localStorage or environment
      const storedKey = localStorage.getItem("LICENSE_KEY");
      const envKey = import.meta.env.VITE_LICENSE_KEY;
      const licenseKey = storedKey || envKey;

      if (!licenseKey) {
        // No license key in production or development (disabled bypass)
        setState({
          isLoading: false,
          isValid: false,
          message: "No license key found. Please enter your license key.",
        });
        return;
      }

      // Validate with server
      const response = await fetch("/api/license/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey }),
      });

      const data: ValidateLicenseResponse = await response.json();

      setState({
        isLoading: false,
        isValid: data.valid,
        message: data.message,
        licensee: data.licensee,
      });
    } catch (error) {
      console.error("[License] Validation failed:", error);
      setState({
        isLoading: false,
        isValid: false,
        message: "Failed to validate license. Please check your connection.",
      });
    }
  }, []);

  useEffect(() => {
    validateLicense();
  }, [validateLicense]);

  return state;
}

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
    message: "Verifying server activation...",
  });

  const checkStatus = useCallback(async () => {
    try {
      // Check server activation status
      const response = await fetch("/api/license/status", {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setState({
          isLoading: false,
          isValid: false,
          message: errorData.message || `Server verification failed (${response.status})`,
        });
        return;
      }

      const data: ValidateLicenseResponse = await response.json();

      setState({
        isLoading: false,
        isValid: !!data.valid,
        message: data.message,
        licensee: data.licensee,
      });
    } catch (error) {
      console.error("[License] Status check failed:", error);
      setState({
        isLoading: false,
        isValid: false,
        message: "Unable to verify server license. Please check your connection.",
      });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return state;
}

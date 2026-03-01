import React, { ReactNode, useEffect, useState } from "react";
import { useLicense } from "@/hooks/use-license";
import { LicenseLockedScreen } from "./LicenseLockedScreen";

interface LicenseProviderProps {
  children: ReactNode;
}

/**
 * LicenseProvider wraps the entire app and ensures the license is valid
 * before rendering any content. If the license is invalid, shows a locked screen.
 */
export function LicenseProvider({ children }: LicenseProviderProps) {
  const licenseState = useLicense();
  const [isSubmittingLicense, setIsSubmittingLicense] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const handleLicenseSubmit = async (licenseKey: string) => {
    setIsSubmittingLicense(true);
    setSubmissionError(null);
    try {
      const response = await fetch("/api/license/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({ licenseKey }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        // Success! Reload the page to unlock for everyone
        window.location.reload();
      } else {
        setSubmissionError(data.message || "Activation failed. Please check your key.");
        setIsSubmittingLicense(false);
      }
    } catch (error) {
      console.error("[License] Failed to submit license:", error);
      setSubmissionError("Network error. Please try again.");
      setIsSubmittingLicense(false);
    }
  };

  // Show loading screen
  if (licenseState.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white mx-auto mb-4" />
          <p className="text-white">{licenseState.message}</p>
        </div>
      </div>
    );
  }

  // Only render app if license is explicitly valid
  if (licenseState.isValid === true) {
    return <>{children}</>;
  }

  // Show locked screen for any other state (null, false, undefined)
  return (
    <LicenseLockedScreen
      message={submissionError || licenseState.message}
      onLicenseSubmit={handleLicenseSubmit}
      isValidating={isSubmittingLicense}
    />
  );
}

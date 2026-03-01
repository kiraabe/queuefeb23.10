import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";

interface LicenseLockedScreenProps {
  message: string;
  onLicenseSubmit: (licenseKey: string) => void;
  isValidating?: boolean;
}

export function LicenseLockedScreen({
  message,
  onLicenseSubmit,
  isValidating = false,
}: LicenseLockedScreenProps) {
  const [licenseKey, setLicenseKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (licenseKey.trim()) {
      onLicenseSubmit(licenseKey.trim());
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md px-8">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          {/* Header */}
          <div className="flex justify-center mb-6">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F71d63217d5204f37a805c350666e42c1%2F871c0002b89a49e1a558735fd2281ab9?format=webp&width=800&height=1200"
              alt="Application Locked Shield"
              className="h-24 w-24 object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            Application Locked
          </h1>

          {/* Alert Message */}
          <div className="flex gap-3 mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{message}</p>
          </div>

          {/* License Key Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="license-key" className="block text-sm font-medium text-slate-700 mb-2">
                Enter License Key
              </label>
              <Input
                id="license-key"
                type="password"
                placeholder="Enter your license key..."
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                disabled={isValidating}
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              disabled={!licenseKey.trim() || isValidating}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2"
            >
              {isValidating ? "Validating..." : "Unlock Application"}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-center text-sm text-slate-500">
              This application is licensed software. <br />
              Please contact your administrator if you need a license key.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

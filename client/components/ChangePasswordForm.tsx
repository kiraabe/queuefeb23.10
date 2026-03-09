import { useState } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export function ChangePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  // Validate new password strength in real-time
  const validatePassword = (password: string): PasswordValidation => {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
  };

  const passwordValidation = validatePassword(newPassword);
  const isPasswordValid =
    Object.values(passwordValidation).every((v) => v) &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    setSuccess(false);

    // Client-side validation
    const errors: string[] = [];

    if (!currentPassword) {
      errors.push("Current password is required");
    }
    if (!newPassword) {
      errors.push("New password is required");
    }
    if (!confirmPassword) {
      errors.push("Confirm password is required");
    }

    if (newPassword !== confirmPassword) {
      errors.push("New password and confirm password do not match");
    }

    if (currentPassword === newPassword) {
      errors.push("New password must be different from current password");
    }

    const validation = validatePassword(newPassword);
    if (newPassword && !validation.minLength) {
      errors.push("Password must be at least 8 characters long");
    }
    if (newPassword && !validation.hasUppercase) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (newPassword && !validation.hasLowercase) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (newPassword && !validation.hasNumber) {
      errors.push("Password must contain at least one number");
    }
    if (newPassword && !validation.hasSpecial) {
      errors.push("Password must contain at least one special character");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch<{ ok: boolean; message: string }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully");

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to change password";
      setValidationErrors([message]);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordRequirementItem = ({
    met,
    text,
  }: {
    met: boolean;
    text: string;
  }) => (
    <div className={cn("flex items-center gap-2 text-sm", met ? "text-green-600" : "text-muted-foreground")}>
      <div
        className={cn(
          "h-4 w-4 rounded-full border-2 flex items-center justify-center",
          met ? "border-green-600 bg-green-50" : "border-muted-foreground",
        )}
      >
        {met && <div className="h-2 w-2 bg-green-600 rounded-full" />}
      </div>
      <span>{text}</span>
    </div>
  );

  return (
    <Card className="border-border/60 bg-card/90 shadow-lg mt-8">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Change Password</CardTitle>
        <CardDescription>
          Update your password to keep your account secure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
          {/* Error Messages */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  {validationErrors.map((error, idx) => (
                    <p key={idx} className="text-sm text-destructive">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <div className="flex gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-600">
                  Your password has been changed successfully
                </p>
              </div>
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-sm font-medium">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isLoading}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm font-medium">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter your new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isLoading}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          {newPassword && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Password Requirements
              </p>
              <div className="space-y-2">
                <PasswordRequirementItem
                  met={passwordValidation.minLength}
                  text="At least 8 characters"
                />
                <PasswordRequirementItem
                  met={passwordValidation.hasUppercase}
                  text="At least one uppercase letter (A-Z)"
                />
                <PasswordRequirementItem
                  met={passwordValidation.hasLowercase}
                  text="At least one lowercase letter (a-z)"
                />
                <PasswordRequirementItem
                  met={passwordValidation.hasNumber}
                  text="At least one number (0-9)"
                />
                <PasswordRequirementItem
                  met={passwordValidation.hasSpecial}
                  text="At least one special character (!@#$%^&* etc.)"
                />
              </div>
            </div>
          )}

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive mt-1">
                Passwords do not match
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isLoading || !isPasswordValid}
              className="flex-1"
            >
              {isLoading ? "Changing Password..." : "Change Password"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setValidationErrors([]);
                setSuccess(false);
              }}
              disabled={isLoading}
            >
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

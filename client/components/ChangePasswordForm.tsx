import { useState, useRef, useEffect } from "react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

interface ValidationRule {
  key: keyof PasswordValidation;
  label: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALIDATION_RULES: ValidationRule[] = [
  { key: "minLength",    label: "At least 8 characters" },
  { key: "hasUppercase", label: "At least one uppercase letter (A-Z)" },
  { key: "hasLowercase", label: "At least one lowercase letter (a-z)" },
  { key: "hasNumber",    label: "At least one number (0-9)" },
  { key: "hasSpecial",   label: "At least one special character (!@#$%^&* etc.)" },
];

const SUCCESS_DISPLAY_MS = 3000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validatePassword(password: string): PasswordValidation {
  return {
    minLength:    password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber:    /\d/.test(password),
    hasSpecial:   /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
}

function mapServerError(message: string): string {
  if (message.includes("Invalid current password") || message.includes("INVALID_CURRENT_PASSWORD")) {
    return "Current password is incorrect. Please try again.";
  }
  if (message.includes("Passwords do not match") || message.includes("PASSWORD_MISMATCH")) {
    return "New passwords do not match. Please check and try again.";
  }
  if (
    message.includes("Password does not meet security requirements") ||
    message.includes("WEAK_PASSWORD")
  ) {
    return "New password does not meet the security requirements listed above.";
  }
  if (
    message.includes("New password cannot be the same as current password") ||
    message.includes("SAME_PASSWORD")
  ) {
    return "New password must be different from your current password.";
  }
  return message;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PasswordRequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm transition-colors duration-200",
        met ? "text-green-600" : "text-muted-foreground",
      )}
    >
      <div
        className={cn(
          "h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-200",
          met ? "border-green-600 bg-green-50" : "border-muted-foreground",
        )}
      >
        {met && <div className="h-2 w-2 bg-green-600 rounded-full" />}
      </div>
      <span>{text}</span>
    </div>
  );
}

interface PasswordInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  autoComplete: string;
  visible: boolean;
  onToggleVisibility: () => void;
  hint?: React.ReactNode;
}

function PasswordInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  disabled,
  autoComplete,
  visible,
  onToggleVisibility,
  hint,
}: PasswordInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          className="pr-10"
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={onToggleVisibility}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChangePasswordForm() {
  const [isLoading, setIsLoading]                   = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword]         = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [success, setSuccess]                   = useState(false);

  // Clean up the success-reset timer on unmount to avoid state updates on
  // an unmounted component.
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const passwordValidation = validatePassword(newPassword);
  const allRequirementsMet = Object.values(passwordValidation).every(Boolean);

  // The submit button is only enabled when every condition is satisfied.
  const isPasswordValid =
    allRequirementsMet &&
    !!confirmPassword &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setValidationErrors([]);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationErrors([]);
    setSuccess(false);

    // Collect client-side errors before hitting the network.
    const errors: string[] = [];

    if (!currentPassword)  errors.push("Current password is required.");
    if (!newPassword)      errors.push("New password is required.");
    if (!confirmPassword)  errors.push("Please confirm your new password.");

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errors.push("New password and confirm password do not match.");
    }
    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.push("New password must be different from your current password.");
    }

    if (newPassword) {
      const v = validatePassword(newPassword);
      if (!v.minLength)    errors.push("Password must be at least 8 characters long.");
      if (!v.hasUppercase) errors.push("Password must contain at least one uppercase letter.");
      if (!v.hasLowercase) errors.push("Password must contain at least one lowercase letter.");
      if (!v.hasNumber)    errors.push("Password must contain at least one number.");
      if (!v.hasSpecial)   errors.push("Password must contain at least one special character.");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch<{ ok: boolean; message: string }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");

      successTimerRef.current = setTimeout(() => setSuccess(false), SUCCESS_DISPLAY_MS);
    } catch (error) {
      const raw     = error instanceof Error ? error.message : "Failed to change password.";
      const message = mapServerError(raw);
      setValidationErrors([message]);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const passwordsTyped         = !!newPassword && !!confirmPassword;
  const confirmMismatch        = passwordsTyped && newPassword !== confirmPassword;

  return (
    <Card className="border-border/60 bg-card/90 shadow-lg mt-8">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Change Password</CardTitle>
        <CardDescription>
          Update your password to keep your account secure.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-6 max-w-md">

          {/* ── Error banner ── */}
          {validationErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-lg bg-destructive/10 border border-destructive/30 p-4"
            >
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden />
                <ul className="space-y-1 flex-1 list-none m-0 p-0">
                  {validationErrors.map((error) => (
                    <li key={error} className="text-sm text-destructive">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── Success banner ── */}
          {success && (
            <div
              role="status"
              className="rounded-lg bg-green-50 border border-green-200 p-4"
            >
              <div className="flex gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden />
                <p className="text-sm text-green-600">
                  Your password has been updated.
                </p>
              </div>
            </div>
          )}

          {/* ── Current password ── */}
          <PasswordInput
            id="current-password"
            label="Current Password"
            placeholder="Enter your current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            disabled={isLoading}
            autoComplete="current-password"
            visible={showCurrentPassword}
            onToggleVisibility={() => setShowCurrentPassword((v) => !v)}
          />

          {/* ── New password ── */}
          <PasswordInput
            id="new-password"
            label="New Password"
            placeholder="Enter your new password"
            value={newPassword}
            onChange={setNewPassword}
            disabled={isLoading}
            autoComplete="new-password"
            visible={showNewPassword}
            onToggleVisibility={() => setShowNewPassword((v) => !v)}
          />

          {/* ── Password requirements (shown as soon as the user starts typing) ── */}
          {newPassword && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-border/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Password Requirements
              </p>
              <div className="space-y-2">
                {VALIDATION_RULES.map(({ key, label }) => (
                  <PasswordRequirementItem
                    key={key}
                    met={passwordValidation[key]}
                    text={label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Confirm password ── */}
          <PasswordInput
            id="confirm-password"
            label="Confirm New Password"
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={isLoading}
            autoComplete="new-password"
            visible={showConfirmPassword}
            onToggleVisibility={() => setShowConfirmPassword((v) => !v)}
            hint={
              confirmMismatch ? (
                <p className="text-xs text-destructive mt-1" role="alert">
                  Passwords do not match.
                </p>
              ) : undefined
            }
          />

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isLoading || !isPasswordValid}
              className="flex-1"
            >
              {isLoading ? "Saving…" : "Save New Password"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
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
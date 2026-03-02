import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PINLockProps {
  isOpen: boolean;
  onUnlock: () => void;
  onClose?: () => void;
  correctPin: string;
}

export default function PINLock({ isOpen, onUnlock, onClose, correctPin }: PINLockProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (pin === correctPin) {
      setPin("");
      setError("");
      onUnlock();
    } else {
      setError("Incorrect PIN. Please try again.");
      setPin("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && onClose) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[400px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <DialogTitle>Licenses Tab Locked</DialogTitle>
          </div>
          <DialogDescription>
            Enter the 4-digit PIN to access the Licenses tab
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label className="text-sm font-medium block mb-2">PIN Code</label>
            <Input
              type="password"
              placeholder="••••"
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPin(value);
              }}
              onKeyDown={handleKeyDown}
              maxLength={4}
              inputMode="numeric"
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={pin.length !== 4}
            className="w-full"
          >
            Unlock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

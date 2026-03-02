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
  _v_: boolean;
  _u_: () => void;
  _c_?: () => void;
  _s_: string;
}

export default function PINLock({ _v_, _u_, _c_, _s_ }: PINLockProps) {
  const [_x_, _sx_] = useState("");
  const [_e_, _se_] = useState("");

  const _h_ = () => {
    if (_x_ === _s_) {
      _sx_("");
      _se_("");
      _u_();
    } else {
      _se_("Incorrect PIN. Please try again.");
      _sx_("");
    }
  };

  const _k_ = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      _h_();
    }
  };

  return (
    <Dialog open={_v_} onOpenChange={(open) => {
      if (!open && _c_) {
        _c_();
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
          {_e_ && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{_e_}</AlertDescription>
            </Alert>
          )}

          <div>
            <label className="text-sm font-medium block mb-2">PIN Code</label>
            <Input
              type="password"
              placeholder="••••"
              value={_x_}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                _sx_(value);
              }}
              onKeyDown={_k_}
              maxLength={4}
              inputMode="numeric"
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          <Button
            onClick={_h_}
            disabled={_x_.length !== 4}
            className="w-full"
          >
            Unlock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

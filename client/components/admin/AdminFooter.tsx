import { useLanguage } from "@/hooks/use-language";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminFooter() {
  const { language, setLanguage } = useLanguage();

  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Company Info */}
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-sm">CTTCS Solution</h4>
            <p className="text-xs text-muted-foreground">
              Track cases, ensure compliance
            </p>
          </div>

          {/* Language Selector */}
          <div className="space-y-2 min-w-max">
            <label className="text-xs font-medium text-muted-foreground block">
              Language
            </label>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="am">Amharic</SelectItem>
                  <SelectItem value="or">Oromo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border mt-6 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {currentYear} Powered by EKD Tech solutions. All rights reserved.
          </p>
          <div className="flex gap-4">
            <a
              href="/privacy"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </a>
            <span className="text-xs text-muted-foreground">•</span>
            <a
              href="/terms"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

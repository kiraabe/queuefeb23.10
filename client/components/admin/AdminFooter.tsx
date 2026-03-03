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
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Company Info */}
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">CTTCS Solution</span> • Track cases, ensure compliance
          </div>

          {/* Links */}
          <div className="flex items-center gap-3">
            <a
              href="/admin/privacy"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </a>
            <span className="text-xs text-muted-foreground">•</span>
            <a
              href="/admin/terms"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </a>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="am">Amharic</SelectItem>
                <SelectItem value="or">Oromo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Copyright */}
          <div className="text-xs text-muted-foreground">
            © {currentYear} Powered by EKD Tech solutions.
          </div>
        </div>
      </div>
    </footer>
  );
}

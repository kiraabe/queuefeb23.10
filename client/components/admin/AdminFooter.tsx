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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Copyright & Company Info */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Queue Management System</h4>
            <p className="text-xs text-muted-foreground">
              © {currentYear} All rights reserved
            </p>
            <p className="text-xs text-muted-foreground">
              Streamlined queue management for efficient service delivery
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="/profile"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  My Profile
                </a>
              </li>
              <li>
                <a
                  href="/privacy"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

          {/* Support & Documentation */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Support</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#help"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Help Center
                </a>
              </li>
              <li>
                <a
                  href="#documentation"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact Support
                </a>
              </li>
            </ul>
          </div>

          {/* Language Selector */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Preferences</h4>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full h-8 text-xs">
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
            Version 1.0.0 • Last updated {new Date().toLocaleDateString()}
          </p>
          <div className="flex gap-4">
            <a
              href="#security"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Security
            </a>
            <span className="text-xs text-muted-foreground">•</span>
            <a
              href="#status"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              System Status
            </a>
            <span className="text-xs text-muted-foreground">•</span>
            <a
              href="#accessibility"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Accessibility
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

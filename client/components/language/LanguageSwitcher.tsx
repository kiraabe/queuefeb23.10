import { useLanguage, Language, LANGUAGE_LABELS } from "@/hooks/use-language";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LanguageSwitcherVariant = "select" | "dropdown" | "dropdown-icon";

interface LanguageSwitcherProps {
  variant?: LanguageSwitcherVariant;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function LanguageSwitcher({
  variant = "select",
  size = "default",
  className,
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  const buttonSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";

  if (variant === "select") {
    return (
      <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Select Language" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(LANGUAGE_LABELS).map(([lang, label]) => (
            <SelectItem key={lang} value={lang}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (variant === "dropdown") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={buttonSize}
            className={className}
          >
            <Globe className="h-4 w-4 mr-2" />
            {LANGUAGE_LABELS[language]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {Object.entries(LANGUAGE_LABELS).map(([lang, label]) => (
            <DropdownMenuItem
              key={lang}
              onSelect={() => setLanguage(lang as Language)}
              className={language === lang ? "bg-accent" : ""}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // dropdown-icon variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label="Change language"
        >
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(LANGUAGE_LABELS).map(([lang, label]) => (
          <DropdownMenuItem
            key={lang}
            onSelect={() => setLanguage(lang as Language)}
            className={language === lang ? "bg-accent" : ""}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useLanguage, Language, LANGUAGE_LABELS } from "@/hooks/use-language";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

const LanguageSwitch = () => {
  const { language, setLanguage } = useLanguage();

  const handleLanguageChange = (value: string) => {
    if (["en", "am", "om"].includes(value)) {
      setLanguage(value as Language);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[180px] border-0 bg-transparent hover:bg-accent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{LANGUAGE_LABELS.en}</SelectItem>
          <SelectItem value="am">{LANGUAGE_LABELS.am}</SelectItem>
          <SelectItem value="om" disabled>
            {LANGUAGE_LABELS.om}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSwitch;

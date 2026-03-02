import { useLanguage } from "./use-language";
import { getTranslation, interpolate, type TranslationKey } from "@/i18n";

export const useTranslation = () => {
  const { language } = useLanguage();

  const t = (key: TranslationKey, variables?: Record<string, string | number>): string => {
    let message = getTranslation(language, key);
    
    if (variables) {
      message = interpolate(message, variables);
    }
    
    return message;
  };

  return { t };
};

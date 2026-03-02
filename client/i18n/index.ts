import en from "./locales/en.json";
import am from "./locales/am.json";
import om from "./locales/om.json";
import type { Language } from "@/hooks/use-language";

export type TranslationKey = `${string}.${string}`;

const translations: Record<Language, typeof en> = {
  en,
  am,
  om,
};

// Deep get function to retrieve nested translation values
function deepGet(obj: any, path: string): any {
  return path.split(".").reduce((current, prop) => current?.[prop], obj);
}

export function getTranslation(language: Language, key: TranslationKey): string {
  const message = deepGet(translations[language], key);

  // Fallback to English if translation is missing
  if (!message) {
    return deepGet(translations.en, key) || key;
  }

  return message;
}

export function interpolate(
  message: string,
  variables: Record<string, string | number>
): string {
  return message.replace(/{(\w+)}/g, (_, key) => {
    return String(variables[key] || `{${key}}`);
  });
}

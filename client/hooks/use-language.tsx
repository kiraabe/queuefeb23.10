import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "am" | "om";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Initialize language synchronously from localStorage
const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") return "en";
  const savedLanguage = localStorage.getItem("app-language") as Language | null;
  if (savedLanguage && ["en", "am", "om"].includes(savedLanguage)) {
    return savedLanguage;
  }
  return "en";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};

// Language label mapping
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  am: "አማርኛ (Amharic)",
  om: "Afaan Oromo",
};

import { STORAGE_KEY } from "@/i18n";
import {
  getLanguage,
  languages,
  toLocale,
  type Language,
  type Locale,
} from "@/i18n/languages";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type LanguageContextType = {
  language: Locale;
  currentLanguage: Language;
  dir: "ltr" | "rtl";
  setLanguage: (code: Locale) => void;
  availableLanguages: Language[];
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<Locale>(
    () => toLocale(i18n.resolvedLanguage || i18n.language) ?? "pt-BR",
  );

  const currentLanguage = getLanguage(language);
  const dir = currentLanguage.dir;

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const matched = toLocale(lng);
      if (matched) setLanguageState(matched);
    };

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [i18n]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // localStorage unavailable: the language lasts only this session
    }
  }, [language, dir]);

  const setLanguage = (code: Locale) => {
    void i18n.changeLanguage(code);
    setLanguageState(code);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        currentLanguage,
        dir,
        setLanguage,
        availableLanguages: languages,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enApp from "../locales/en/app.json";
import enCommon from "../locales/en/common.json";
import ptApp from "../locales/pt-BR/app.json";
import { defaultLocale, toLocale } from "./languages";

// Namespaces:
// - "app":    PostPilot texts (all translated into pt-BR and en)
// - "common": texts of the TailAdmin demo pages (en only;
//             in pt-BR they fall back to English)
export const resources = {
  "pt-BR": { app: ptApp },
  en: { app: enApp, common: enCommon },
} as const;

export const STORAGE_KEY = "postpilot:idioma";

function initialLanguage() {
  if (typeof window === "undefined") return defaultLocale;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
  return toLocale(saved) ?? toLocale(navigator.language) ?? defaultLocale;
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: "en",
  supportedLngs: ["pt-BR", "en"],
  defaultNS: "common",
  ns: ["app", "common"],
  interpolation: {
    escapeValue: false, // React already escapes values
    prefix: "{",
    suffix: "}",
  },
});

export default i18n;

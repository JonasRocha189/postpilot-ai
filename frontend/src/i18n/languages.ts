import { BrFlagIcon, UsFlagIcon } from "@/icons";
import type React from "react";

export const locales = ["pt-BR", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt-BR";

export interface Language {
  id: Locale;
  name: string;
  shortName: string;
  dir: "ltr" | "rtl";
  FlagIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export const languages: Language[] = [
  {
    id: "pt-BR",
    name: "Português (Brasil)",
    shortName: "PT",
    dir: "ltr",
    FlagIcon: BrFlagIcon,
  },
  {
    id: "en",
    name: "English",
    shortName: "EN",
    dir: "ltr",
    FlagIcon: UsFlagIcon,
  },
];

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

/** Turns any code (e.g. "pt", "en-US") into a supported language. */
export function toLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  if (isLocale(value)) return value;
  const base = value.toLowerCase().split("-")[0];
  if (base === "pt") return "pt-BR";
  if (base === "en") return "en";
  return null;
}

export function getLanguage(locale: Locale): Language {
  return languages.find((l) => l.id === locale) || languages[0];
}

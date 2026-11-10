import type { Network } from "@/lib/domain";
import { useTranslation } from "react-i18next";

// Content of the /best-practices page. The texts live in the translation
// files (bestPractices.*); here only the types and reading them as objects.

export type Format = {
  name: string;
  size: string;
  /** "4:5", "1.91:1"... (draws the ratio thumbnail) */
  ratio: string;
  note: string;
};

export type Item = { name: string; description: string };

export type NetworkContent = {
  summary: string;
  formats: Format[];
  text: { visible: string; ideal: string; tips: string[] };
  hashtags: { count: string; tips: string[] };
  practices: string[];
  timing: string[];
  metrics: Item[];
  inspiration: Item[];
};

export type Principle = { title: string; text: string };

/** Reads a structured part (lists and objects) of the "app" namespace. */
export function useContent() {
  const { t } = useTranslation("app", { keyPrefix: "bestPractices" });
  return {
    principles: t("principles", { returnObjects: true }) as Principle[],
    generalInspiration: t("generalInspiration", {
      returnObjects: true,
    }) as Item[],
    network: (network: Network) =>
      t(`networks.${network}`, { returnObjects: true }) as NetworkContent,
  };
}

/** "4:5" → 0.8 (width ÷ height), for CSS aspect-ratio. */
export function parseRatio(ratio: string): number {
  const [width, height] = ratio.split(":").map(Number);
  return width > 0 && height > 0 ? width / height : 1;
}

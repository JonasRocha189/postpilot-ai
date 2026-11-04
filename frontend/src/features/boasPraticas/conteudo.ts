import type { Rede } from "@/lib/dominio";
import { useTranslation } from "react-i18next";

// Conteúdo da página /best-practices. Os textos ficam nos arquivos de
// tradução (bestPractices.*); aqui só os tipos e a leitura como objetos.

export type Formato = {
  name: string;
  size: string;
  /** "4:5", "1.91:1"... (desenha a miniatura da proporção) */
  ratio: string;
  note: string;
};

export type Item = { name: string; description: string };

export type ConteudoRede = {
  summary: string;
  formats: Formato[];
  text: { visible: string; ideal: string; tips: string[] };
  hashtags: { count: string; tips: string[] };
  practices: string[];
  timing: string[];
  metrics: Item[];
  inspiration: Item[];
};

export type Principio = { title: string; text: string };

/** Lê um trecho estruturado (listas e objetos) do namespace "app". */
export function useConteudo() {
  const { t } = useTranslation("app", { keyPrefix: "bestPractices" });
  return {
    principios: t("principles", { returnObjects: true }) as Principio[],
    inspiracaoGeral: t("generalInspiration", { returnObjects: true }) as Item[],
    rede: (rede: Rede) =>
      t(`networks.${rede}`, { returnObjects: true }) as ConteudoRede,
  };
}

/** "4:5" → 0.8 (largura ÷ altura), para o CSS aspect-ratio. */
export function proporcao(ratio: string): number {
  const [largura, altura] = ratio.split(":").map(Number);
  return largura > 0 && altura > 0 ? largura / altura : 1;
}

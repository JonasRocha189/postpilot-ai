import type { Rede } from "@/lib/dominio";

// Espelha o schema do backend (ver docs/modelo-de-dados.md e docs/api.md)

/**
 * Um registro de métricas de uma variação publicada. Os números são o total
 * acumulado no momento da coleta; o registro mais recente é o atual.
 */
export type Metrica = {
  id: string;
  variacao_id: string;
  publicado_em: string; // ISO
  impressoes: number;
  curtidas: number;
  comentarios: number;
  compartilhamentos: number;
  cliques: number;
  coletado_em: string; // ISO
};

/** Corpo de POST /variacoes/{id}/metricas */
export type MetricaInput = Omit<Metrica, "id" | "variacao_id">;

export const CAMPOS_NUMERICOS = [
  "impressoes",
  "curtidas",
  "comentarios",
  "compartilhamentos",
  "cliques",
] as const satisfies readonly (keyof MetricaInput)[];

export type CampoNumerico = (typeof CAMPOS_NUMERICOS)[number];

// --- Import from a network's export (contract in English, see _docs/api.md) --

/** One row of POST /metrics/import: the totals of a variation on a date. */
export type MetricsImportRow = {
  variation_id: string;
  published_at: string; // ISO
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
};

/** Body of POST /metrics/import (all rows are saved, or none: 422). */
export type MetricsImportInput = {
  network: Rede;
  collected_at: string; // ISO
  rows: MetricsImportRow[];
};

export type MetricsImportResult = { created: number };

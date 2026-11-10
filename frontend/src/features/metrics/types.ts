import type { Network } from "@/lib/domain";

// Mirrors the backend schema (see _docs/modelo-de-dados.md and _docs/api.md)

/**
 * A metrics record of a published variation (fake API only: the real one gets
 * metrics through POST /metrics/import). The numbers are the running total at
 * collection time; the latest record is the current one.
 */
export type Metric = {
  id: string;
  variation_id: string;
  published_at: string; // ISO
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  collected_at: string; // ISO
};

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
  network: Network;
  collected_at: string; // ISO
  rows: MetricsImportRow[];
};

export type MetricsImportResult = { created: number };

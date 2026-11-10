import { apiFetch, apiMode } from "@/lib/api/http";
import { metricasMock } from "./mock";
import type { MetricsImportInput, MetricsImportResult } from "./types";

export interface MetricasService {
  /** Imports a network export in one request (all rows or none). */
  importMetrics(input: MetricsImportInput): Promise<MetricsImportResult>;
}

const metricasHttp: MetricasService = {
  importMetrics: (input) =>
    apiFetch<MetricsImportResult>("/metrics/import", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export const metricasService: MetricasService =
  apiMode === "mock" ? metricasMock : metricasHttp;

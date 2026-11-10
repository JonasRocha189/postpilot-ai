import { apiFetch, apiMode } from "@/lib/api/http";
import { metricsMock } from "./mock";
import type { MetricsImportInput, MetricsImportResult } from "./types";

export interface MetricsService {
  /** Imports a network export in one request (all rows or none). */
  importMetrics(input: MetricsImportInput): Promise<MetricsImportResult>;
}

const metricsHttp: MetricsService = {
  importMetrics: (input) =>
    apiFetch<MetricsImportResult>("/metrics/import", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export const metricsService: MetricsService =
  apiMode === "mock" ? metricsMock : metricsHttp;

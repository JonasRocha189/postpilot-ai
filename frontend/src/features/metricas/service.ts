import { apiFetch, apiMode } from "@/lib/api/http";
import { metricasMock } from "./mock";
import type {
  Metrica,
  MetricaInput,
  MetricsImportInput,
  MetricsImportResult,
} from "./types";

export interface MetricasService {
  /** Registros da variação, do mais recente para o mais antigo. */
  listar(variacaoId: string): Promise<Metrica[]>;
  /** `422` se o post não estiver publicado. */
  registrar(variacaoId: string, input: MetricaInput): Promise<Metrica>;
  excluir(id: string): Promise<void>;
  /** Imports a network export in one request (all rows or none). */
  importMetrics(input: MetricsImportInput): Promise<MetricsImportResult>;
}

const metricasHttp: MetricasService = {
  listar: (variacaoId) =>
    apiFetch<Metrica[]>(`/variations/${variacaoId}/metrics`),
  registrar: (variacaoId, input) =>
    apiFetch<Metrica>(`/variations/${variacaoId}/metrics`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  excluir: (id) => apiFetch<void>(`/metrics/${id}`, { method: "DELETE" }),
  importMetrics: (input) =>
    apiFetch<MetricsImportResult>("/metrics/import", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export const metricasService: MetricasService =
  apiMode === "mock" ? metricasMock : metricasHttp;

// API FICTÍCIA de métricas (ver lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { latencia, mockDb, variacaoDoMock } from "@/lib/api/mockDb";
import type { MetricasService } from "./service";

export const metricasMock: MetricasService = {
  async importMetrics(input) {
    await latencia();
    if (input.rows.length === 0) throw new ApiError(422, "No rows to import");
    // Like the backend: every row must be a published variation of the network
    const checked = input.rows.map((row) => {
      const { variacao } = variacaoDoMock(row.variation_id);
      if (
        variacao.network !== input.network ||
        variacao.status !== "published"
      ) {
        throw new ApiError(422, "Variation is not published on this network");
      }
      return row;
    });
    for (const row of checked) {
      mockDb.metricas.inserir({
        id: crypto.randomUUID(),
        variacao_id: row.variation_id,
        publicado_em: row.published_at,
        impressoes: row.impressions,
        curtidas: row.likes,
        comentarios: row.comments,
        compartilhamentos: row.shares,
        cliques: row.clicks,
        coletado_em: input.collected_at,
      });
    }
    return { created: checked.length };
  },
};

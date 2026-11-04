// API FICTÍCIA de métricas (ver lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { latencia, mockDb, variacaoDoMock } from "@/lib/api/mockDb";
import type { MetricasService } from "./service";

export const metricasMock: MetricasService = {
  async listar(variacaoId) {
    await latencia();
    variacaoDoMock(variacaoId);
    return mockDb.metricas
      .todos()
      .filter((m) => m.variacao_id === variacaoId)
      .sort((a, b) => b.coletado_em.localeCompare(a.coletado_em));
  },

  async registrar(variacaoId, input) {
    await latencia();
    const { post } = variacaoDoMock(variacaoId);
    if (post.status !== "published") {
      throw new ApiError(
        422,
        "Só é possível registrar métricas de posts publicados",
      );
    }
    if (input.coletado_em < input.publicado_em) {
      throw new ApiError(422, "A coleta não pode ser antes da publicação");
    }
    return mockDb.metricas.inserir({
      ...input,
      id: crypto.randomUUID(),
      variacao_id: variacaoId,
    });
  },

  async excluir(id) {
    await latencia();
    mockDb.metricas.encontrar(id, "Métrica");
    mockDb.metricas.remover(id);
  },
};

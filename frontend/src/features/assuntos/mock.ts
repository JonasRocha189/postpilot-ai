// API FICTÍCIA de assuntos (ver lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { agoraIso, latencia, mockDb } from "@/lib/api/mockDb";
import type { AssuntosService } from "./service";

const NOME = "Assunto";

export const assuntosMock: AssuntosService = {
  async listar(projetoId) {
    await latencia();
    mockDb.projetos.encontrar(projetoId, "Projeto");
    return mockDb.assuntos
      .todos()
      .filter((a) => a.project_id === projetoId)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async obter(id) {
    await latencia();
    return mockDb.assuntos.encontrar(id, NOME);
  },

  async criar(projetoId, input) {
    await latencia();
    mockDb.projetos.encontrar(projetoId, "Projeto");
    const agora = agoraIso();
    return mockDb.assuntos.inserir({
      ...input,
      id: crypto.randomUUID(),
      project_id: projetoId,
      created_at: agora,
      updated_at: agora,
    });
  },

  async atualizar(id, input) {
    await latencia();
    const atual = mockDb.assuntos.encontrar(id, NOME);
    return mockDb.assuntos.substituir({ ...atual, ...input, updated_at: agoraIso() });
  },

  async excluir(id) {
    await latencia();
    mockDb.assuntos.encontrar(id, NOME);
    // Regra da API: só exclui assunto sem posts
    if (mockDb.posts.todos().some((p) => p.subject_id === id)) {
      throw new ApiError(409, "O assunto ainda tem posts");
    }
    mockDb.assuntos.remover(id);
  },
};

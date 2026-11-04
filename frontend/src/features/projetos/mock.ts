// API FICTÍCIA de projetos (ver lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { agoraIso, latencia, mockDb } from "@/lib/api/mockDb";
import type { ProjetosService } from "./service";
import type { Projeto } from "./types";

const NOME = "Projeto";

// Devolve só os campos públicos (dados antigos do mock podiam ter campos extras)
const publico = (p: Projeto): Projeto => ({
  id: p.id,
  name: p.name,
  description: p.description,
  target_audience: p.target_audience,
  voice_tone: p.voice_tone,
  created_at: p.created_at,
  updated_at: p.updated_at,
});

export const projetosMock: ProjetosService = {
  async listar() {
    await latencia();
    return mockDb.projetos
      .todos()
      .map(publico)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async obter(id) {
    await latencia();
    return publico(mockDb.projetos.encontrar(id, NOME));
  },

  async criar(input) {
    await latencia();
    const agora = agoraIso();
    return publico(
      mockDb.projetos.inserir({
        ...input,
        id: crypto.randomUUID(),
        created_at: agora,
        updated_at: agora,
      }),
    );
  },

  async atualizar(id, input) {
    await latencia();
    const atual = mockDb.projetos.encontrar(id, NOME);
    return publico(
      mockDb.projetos.substituir({ ...atual, ...input, updated_at: agoraIso() }),
    );
  },

  async excluir(id) {
    await latencia();
    mockDb.projetos.encontrar(id, NOME);
    // Regra da API: só exclui projeto sem assuntos, documentos nem imagens
    if (
      mockDb.assuntos.todos().some((a) => a.project_id === id) ||
      mockDb.documentos.todos().some((d) => d.project_id === id) ||
      mockDb.imagens.todos().some((i) => i.project_id === id)
    ) {
      throw new ApiError(409, "Project has subjects, documents or images");
    }
    mockDb.projetos.remover(id);
  },
};

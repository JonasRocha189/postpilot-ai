// API FICTÍCIA de posts (ver lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { agoraIso, latencia, mockDb } from "@/lib/api/mockDb";
import { erroRegraPost } from "./redes";
import type { PostsService } from "./service";
import type { PostInput } from "./types";

const NOME = "Post";

function validarAssunto(subjectId: string) {
  if (!mockDb.assuntos.todos().some((a) => a.id === subjectId)) {
    throw new ApiError(404, "Subject not found");
  }
}

/** As imagens precisam ser da biblioteca do projeto do assunto, sem repetir. */
function validarImagens(subjectId: string, imageIds: string[]) {
  const assunto = mockDb.assuntos.encontrar(subjectId, "Assunto");
  const daBiblioteca = new Set(
    mockDb.imagens
      .todos()
      .filter((i) => i.project_id === assunto.project_id)
      .map((i) => i.id),
  );
  if (
    new Set(imageIds).size !== imageIds.length ||
    imageIds.some((id) => !daBiblioteca.has(id))
  ) {
    throw new ApiError(422, "Image is not in this project's library");
  }
}

/** Regras da rede (formato, texto e quantidade de imagens), como o backend. */
function validarRegras(post: PostInput) {
  const erro = erroRegraPost({
    network: post.network,
    format: post.format,
    imagens: post.image_ids.length,
    texto: post.content ?? "",
    status: post.status,
  });
  if (erro) throw new ApiError(422, erro.mensagem);
}

export const postsMock: PostsService = {
  async listar(projetoId, filtros = {}) {
    await latencia();
    const assuntosDoProjeto = new Set(
      mockDb.assuntos
        .todos()
        .filter((a) => a.project_id === projetoId)
        .map((a) => a.id),
    );

    return mockDb.posts
      .todos()
      .filter((p) => assuntosDoProjeto.has(p.subject_id))
      .filter((p) => !filtros.status || p.status === filtros.status)
      .filter((p) => !filtros.subject_id || p.subject_id === filtros.subject_id)
      .filter((p) => !filtros.from || (p.expected_date ?? "") >= filtros.from)
      .filter((p) => !filtros.to || (p.expected_date ?? "9999") <= filtros.to)
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async obter(id) {
    await latencia();
    return mockDb.posts.encontrar(id, NOME);
  },

  async criar(input) {
    await latencia();
    validarAssunto(input.subject_id);
    validarImagens(input.subject_id, input.image_ids);
    validarRegras(input);
    const agora = agoraIso();
    return mockDb.posts.inserir({
      ...input,
      id: crypto.randomUUID(),
      created_at: agora,
      updated_at: agora,
    });
  },

  async atualizar(id, input) {
    await latencia();
    const atual = mockDb.posts.encontrar(id, NOME);
    validarAssunto(input.subject_id);
    validarImagens(input.subject_id, input.image_ids);
    validarRegras(input);
    return mockDb.posts.substituir({
      ...atual,
      ...input,
      updated_at: agoraIso(),
    });
  },

  async excluir(id) {
    await latencia();
    mockDb.posts.encontrar(id, NOME);
    mockDb.posts.remover(id);
  },
};

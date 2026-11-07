// FAKE posts API (see lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { agoraIso, latencia, mockDb } from "@/lib/api/mockDb";
import { erroRegraPost } from "./redes";
import type { PostsService } from "./service";
import type { Post, PostInput, PostVariation } from "./types";
import { variationMatches } from "./types";

const NAME = "Post";

function checkSubject(subjectId: string) {
  if (!mockDb.assuntos.todos().some((a) => a.id === subjectId)) {
    throw new ApiError(404, "Subject not found");
  }
}

/** Like the backend: at least one variation, one per network, network rules,
 * and images from the subject's project library (no repeats). */
function checkVariations(input: PostInput) {
  const { variations } = input;
  if (variations.length === 0) {
    throw new ApiError(422, "A post needs at least one variation");
  }
  if (new Set(variations.map((v) => v.network)).size !== variations.length) {
    throw new ApiError(422, "Only one variation per network");
  }
  const subject = mockDb.assuntos.encontrar(input.subject_id, "Assunto");
  const library = new Set(
    mockDb.imagens
      .todos()
      .filter((i) => i.project_id === subject.project_id)
      .map((i) => i.id),
  );
  for (const v of variations) {
    if (
      new Set(v.image_ids).size !== v.image_ids.length ||
      v.image_ids.some((id) => !library.has(id))
    ) {
      throw new ApiError(422, "Image is not in this project's library");
    }
    const error = erroRegraPost({
      network: v.network,
      format: v.format,
      imagens: v.image_ids.length,
      texto: v.content ?? "",
      status: v.status,
    });
    if (error) throw new ApiError(422, error.mensagem);
  }
}

/** Keeps the id of each network's variation (metrics hang on it). */
function withIds(input: PostInput, current?: Post): PostVariation[] {
  return input.variations.map((v) => ({
    ...v,
    id:
      current?.variations.find((old) => old.network === v.network)?.id ??
      crypto.randomUUID(),
  }));
}

export const postsMock: PostsService = {
  async listar(projetoId, filtros = {}) {
    await latencia();
    const subjectsOfProject = new Set(
      mockDb.assuntos
        .todos()
        .filter((a) => a.project_id === projetoId)
        .map((a) => a.id),
    );
    return mockDb.posts
      .todos()
      .filter((p) => subjectsOfProject.has(p.subject_id))
      .filter((p) => !filtros.subject_id || p.subject_id === filtros.subject_id)
      .filter((p) => p.variations.some((v) => variationMatches(v, filtros)))
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async obter(id) {
    await latencia();
    return mockDb.posts.encontrar(id, NAME);
  },

  async criar(input) {
    await latencia();
    checkSubject(input.subject_id);
    checkVariations(input);
    const now = agoraIso();
    return mockDb.posts.inserir({
      id: crypto.randomUUID(),
      subject_id: input.subject_id,
      title: input.title,
      variations: withIds(input),
      created_at: now,
      updated_at: now,
    });
  },

  async atualizar(id, input) {
    await latencia();
    const current = mockDb.posts.encontrar(id, NAME);
    checkSubject(input.subject_id);
    checkVariations(input);
    return mockDb.posts.substituir({
      ...current,
      subject_id: input.subject_id,
      title: input.title,
      variations: withIds(input, current),
      updated_at: agoraIso(),
    });
  },

  async excluir(id) {
    await latencia();
    mockDb.posts.encontrar(id, NAME);
    mockDb.posts.remover(id);
  },
};

import { apiFetch, apiMode } from "@/lib/api/http";
import { postsMock } from "./mock";
import type { Post, PostFiltros, PostInput } from "./types";

export interface PostsService {
  listar(projetoId: string, filtros?: PostFiltros): Promise<Post[]>;
  obter(id: string): Promise<Post>;
  criar(input: PostInput): Promise<Post>;
  /** Substitui o post e todas as suas variações. */
  atualizar(id: string, input: PostInput): Promise<Post>;
  excluir(id: string): Promise<void>;
}

function query(projetoId: string, filtros: PostFiltros = {}) {
  const params = new URLSearchParams({ project_id: projetoId });
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) params.set(chave, valor);
  }
  return params.toString();
}

const postsHttp: PostsService = {
  listar: (projetoId, filtros) =>
    apiFetch<Post[]>(`/posts?${query(projetoId, filtros)}`),
  obter: (id) => apiFetch<Post>(`/posts/${id}`),
  criar: (input) =>
    apiFetch<Post>("/posts", { method: "POST", body: JSON.stringify(input) }),
  atualizar: (id, input) =>
    apiFetch<Post>(`/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  excluir: (id) => apiFetch<void>(`/posts/${id}`, { method: "DELETE" }),
};

export const postsService: PostsService =
  apiMode === "mock" ? postsMock : postsHttp;

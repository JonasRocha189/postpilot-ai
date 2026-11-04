import { apiFetch, apiMode } from "@/lib/api/http";
import { projetosMock } from "./mock";
import type { Projeto, ProjetoInput } from "./types";

export interface ProjetosService {
  listar(): Promise<Projeto[]>;
  obter(id: string): Promise<Projeto>;
  criar(input: ProjetoInput): Promise<Projeto>;
  atualizar(id: string, input: ProjetoInput): Promise<Projeto>;
  /** Rejeita com ApiError 409 quando o projeto ainda tem assuntos, documentos ou imagens. */
  excluir(id: string): Promise<void>;
}

const projetosHttp: ProjetosService = {
  listar: () => apiFetch<Projeto[]>("/projects"),
  obter: (id) => apiFetch<Projeto>(`/projects/${id}`),
  criar: (input) =>
    apiFetch<Projeto>("/projects", { method: "POST", body: JSON.stringify(input) }),
  atualizar: (id, input) =>
    apiFetch<Projeto>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  excluir: (id) => apiFetch<void>(`/projects/${id}`, { method: "DELETE" }),
};

export const projetosService: ProjetosService =
  apiMode === "mock" ? projetosMock : projetosHttp;

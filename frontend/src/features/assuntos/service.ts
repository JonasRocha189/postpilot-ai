import { apiFetch, apiMode } from "@/lib/api/http";
import { assuntosMock } from "./mock";
import type { Assunto, AssuntoInput } from "./types";

export interface AssuntosService {
  listar(projetoId: string): Promise<Assunto[]>;
  obter(id: string): Promise<Assunto>;
  criar(projetoId: string, input: AssuntoInput): Promise<Assunto>;
  atualizar(id: string, input: AssuntoInput): Promise<Assunto>;
  /** Rejeita com ApiError 409 quando o assunto ainda tem posts. */
  excluir(id: string): Promise<void>;
}

const assuntosHttp: AssuntosService = {
  listar: (projetoId) =>
    apiFetch<Assunto[]>(`/subjects?${new URLSearchParams({ project_id: projetoId })}`),
  obter: (id) => apiFetch<Assunto>(`/subjects/${id}`),
  criar: (projetoId, input) =>
    apiFetch<Assunto>("/subjects", {
      method: "POST",
      body: JSON.stringify({ ...input, project_id: projetoId }),
    }),
  atualizar: (id, input) =>
    apiFetch<Assunto>(`/subjects/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  excluir: (id) => apiFetch<void>(`/subjects/${id}`, { method: "DELETE" }),
};

export const assuntosService: AssuntosService =
  apiMode === "mock" ? assuntosMock : assuntosHttp;

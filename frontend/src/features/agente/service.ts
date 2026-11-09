import { apiFetch, apiMode } from "@/lib/api/http";
import { agenteMock } from "./mock";
import type { AgentRun, AgentRunInput } from "./types";

export interface AgenteService {
  /**
   * Inicia uma execução. Responde logo (202) com status "running";
   * o progresso é acompanhado com `obter` até o status final.
   */
  executar(input: AgentRunInput): Promise<AgentRun>;
  listar(projetoId: string): Promise<AgentRun[]>;
  obter(id: string): Promise<AgentRun>;
}

const agenteHttp: AgenteService = {
  executar: (input) =>
    apiFetch<AgentRun>("/agent/runs", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listar: (projetoId) =>
    apiFetch<AgentRun[]>(
      `/agent/runs?${new URLSearchParams({ project_id: projetoId })}`,
    ),
  obter: (id) => apiFetch<AgentRun>(`/agent/runs/${id}`),
};

export const agenteService: AgenteService = apiMode === "mock" ? agenteMock : agenteHttp;

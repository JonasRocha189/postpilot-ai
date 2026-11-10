import { apiFetch, apiMode } from "@/lib/api/http";
import { agentMock } from "./mock";
import type { AgentRun, AgentRunInput } from "./types";

export interface AgentService {
  /**
   * Starts a run. Answers right away (202) with status "running";
   * progress is followed with `get` until the final status.
   */
  startRun(input: AgentRunInput): Promise<AgentRun>;
  list(projectId: string): Promise<AgentRun[]>;
  get(id: string): Promise<AgentRun>;
}

const agentHttp: AgentService = {
  startRun: (input) =>
    apiFetch<AgentRun>("/agent/runs", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  list: (projectId) =>
    apiFetch<AgentRun[]>(
      `/agent/runs?${new URLSearchParams({ project_id: projectId })}`,
    ),
  get: (id) => apiFetch<AgentRun>(`/agent/runs/${id}`),
};

export const agentService: AgentService =
  apiMode === "mock" ? agentMock : agentHttp;

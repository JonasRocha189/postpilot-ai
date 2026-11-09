import type { ModoAgente, StatusExecucao } from "@/lib/dominio";

// Mirrors the backend schema (see _docs/api.md, "Resposta de GET /agent/runs/{id}")

export type AgentStep = {
  id: string;
  step_number: number;
  /** Name of the tool called (e.g. "search_documents") */
  tool: string;
  arguments: Record<string, unknown>;
  /** Short, readable result (the full result stays in the database) */
  result_summary: string | null;
  duration_ms: number | null;
  error: string | null;
};

export type AgentRun = {
  id: string;
  project_id: string;
  mode: ModoAgente;
  request: string;
  status: StatusExecucao;
  /** The agent's final answer */
  response: string | null;
  /** Draft saved by the agent (creation mode) */
  post_id: string | null;
  iterations: number;
  steps: AgentStep[];
  started_at: string;
  finished_at: string | null;
};

/** Body of POST /agent/runs */
export type AgentRunInput = {
  project_id: string;
  mode: ModoAgente;
  request: string;
};

/** Iteration limit of the loop (agent rule; the backend enforces it) */
export const MAX_ITERATIONS = 8;

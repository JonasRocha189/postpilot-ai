import type { ModoAgente, StatusExecucao } from "@/lib/dominio";

// Espelha o schema do backend (ver docs/modelo-de-dados.md e docs/agente-e-rag.md)

export type PassoAgente = {
  id: string;
  ordem: number;
  /** Nome da tool chamada (ex.: "buscar_documentos") */
  tool: string;
  argumentos: Record<string, unknown>;
  /** Resumo legível do resultado (o resultado completo fica só no banco) */
  resultado_resumo: string | null;
  duracao_ms: number | null;
  erro: string | null;
};

export type ExecucaoAgente = {
  id: string;
  project_id: string;
  modo: ModoAgente;
  pedido: string;
  status: StatusExecucao;
  /** Resposta final do agente (texto) */
  resposta: string | null;
  /** Post salvo como rascunho, quando houver */
  post_id: string | null;
  iteracoes: number;
  passos: PassoAgente[];
  iniciada_em: string;
  finalizada_em: string | null;
};

/** Corpo de POST /agent/runs */
export type ExecucaoInput = {
  project_id: string;
  modo: ModoAgente;
  pedido: string;
};

/** Limite de iterações do loop (regra do agente) */
export const MAX_ITERACOES = 8;

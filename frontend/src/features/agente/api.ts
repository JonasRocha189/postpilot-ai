import { postsKeys } from "@/features/posts/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agenteService } from "./service";
import type { AgentRun, AgentRunInput } from "./types";

export const execucoesKeys = {
  all: ["execucoes"] as const,
  list: (projetoId: string) => ["execucoes", "list", projetoId] as const,
  detail: (id: string) => ["execucoes", "detail", id] as const,
};

export function useExecutarAgente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentRunInput) => agenteService.executar(input),
    onSuccess: (execucao) => {
      queryClient.setQueryData(execucoesKeys.detail(execucao.id), execucao);
      void queryClient.invalidateQueries({ queryKey: execucoesKeys.list(execucao.project_id) });
    },
  });
}

export function useExecucoes(projetoId: string | undefined) {
  return useQuery({
    queryKey: execucoesKeys.list(projetoId ?? ""),
    queryFn: () => agenteService.listar(projetoId!),
    enabled: Boolean(projetoId),
    refetchInterval: (query) =>
      query.state.data?.some((e) => e.status === "running") ? 2000 : false,
  });
}

/** Acompanha uma execução: consulta a cada ~0,7 s enquanto está "running". */
export function useExecucao(id: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: execucoesKeys.detail(id ?? ""),
    queryFn: async (): Promise<AgentRun> => {
      const anterior = queryClient.getQueryData<AgentRun>(execucoesKeys.detail(id!));
      const execucao = await agenteService.obter(id!);
      // Ao terminar, atualiza o histórico e os posts (pode ter um rascunho novo)
      if (anterior?.status === "running" && execucao.status !== "running") {
        void queryClient.invalidateQueries({ queryKey: execucoesKeys.list(execucao.project_id) });
        void queryClient.invalidateQueries({ queryKey: postsKeys.all });
      }
      return execucao;
    },
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 700 : false),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { metricasService } from "./service";
import type { MetricaInput, MetricsImportInput } from "./types";

export const metricasKeys = {
  all: ["metricas"] as const,
  list: (variacaoId: string) => ["metricas", "list", variacaoId] as const,
};

export function useMetricas(variacaoId: string | undefined) {
  return useQuery({
    queryKey: metricasKeys.list(variacaoId ?? ""),
    queryFn: () => metricasService.listar(variacaoId!),
    enabled: Boolean(variacaoId),
  });
}

export function useRegistrarMetrica() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      variacaoId,
      input,
    }: {
      variacaoId: string;
      input: MetricaInput;
    }) => metricasService.registrar(variacaoId, input),
    onSuccess: (_, { variacaoId }) =>
      queryClient.invalidateQueries({
        queryKey: metricasKeys.list(variacaoId),
      }),
  });
}

export function useExcluirMetrica() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => metricasService.excluir(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: metricasKeys.all }),
  });
}

export function useImportMetrics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MetricsImportInput) =>
      metricasService.importMetrics(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: metricasKeys.all });
      // The dashboard's performance report ("reports" in features/dashboard/api.ts)
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

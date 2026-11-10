import { useMutation, useQueryClient } from "@tanstack/react-query";
import { metricasService } from "./service";
import type { MetricsImportInput } from "./types";

export const metricasKeys = {
  all: ["metricas"] as const,
};

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

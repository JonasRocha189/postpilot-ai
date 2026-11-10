import { useMutation, useQueryClient } from "@tanstack/react-query";
import { metricsService } from "./service";
import type { MetricsImportInput } from "./types";

export const metricsKeys = {
  all: ["metrics"] as const,
};

export function useImportMetrics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MetricsImportInput) =>
      metricsService.importMetrics(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: metricsKeys.all });
      // The dashboard's performance report ("reports" in features/dashboard/api.ts)
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

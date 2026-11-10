import { postsKeys } from "@/features/posts/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agentService } from "./service";
import type { AgentRun, AgentRunInput } from "./types";

export const runsKeys = {
  all: ["runs"] as const,
  list: (projectId: string) => ["runs", "list", projectId] as const,
  detail: (id: string) => ["runs", "detail", id] as const,
};

export function useRunAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentRunInput) => agentService.startRun(input),
    onSuccess: (run) => {
      queryClient.setQueryData(runsKeys.detail(run.id), run);
      void queryClient.invalidateQueries({
        queryKey: runsKeys.list(run.project_id),
      });
    },
  });
}

export function useRuns(projectId: string | undefined) {
  return useQuery({
    queryKey: runsKeys.list(projectId ?? ""),
    queryFn: () => agentService.list(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (query) =>
      query.state.data?.some((e) => e.status === "running") ? 2000 : false,
  });
}

/** Follows a run: polls every ~0.7 s while it is "running". */
export function useRun(id: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: runsKeys.detail(id ?? ""),
    queryFn: async (): Promise<AgentRun> => {
      const previous = queryClient.getQueryData<AgentRun>(runsKeys.detail(id!));
      const run = await agentService.get(id!);
      // When it ends, refresh the history and the posts (there may be a new draft)
      if (previous?.status === "running" && run.status !== "running") {
        void queryClient.invalidateQueries({
          queryKey: runsKeys.list(run.project_id),
        });
        void queryClient.invalidateQueries({ queryKey: postsKeys.all });
      }
      return run;
    },
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 700 : false,
  });
}

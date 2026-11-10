import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentsService, type Progress } from "./service";

export const documentsKeys = {
  all: ["documents"] as const,
  list: (projectId: string) => ["documents", "list", projectId] as const,
};

export function useDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: documentsKeys.list(projectId ?? ""),
    queryFn: () => documentsService.list(projectId!),
    enabled: Boolean(projectId),
    // While any document is being processed, poll again
    refetchInterval: (query) =>
      query.state.data?.some(
        (d) => d.status === "pending" || d.status === "processing",
      )
        ? 1500
        : false,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      file,
      onProgress,
    }: {
      projectId: string;
      file: File;
      onProgress?: Progress;
    }) => documentsService.send(projectId, file, onProgress),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentsKeys.all }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsService.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: documentsKeys.all }),
  });
}

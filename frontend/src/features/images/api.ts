import type { Progress } from "@/lib/api/s3";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { imagesService } from "./service";

export const imagesKeys = {
  all: ["images"] as const,
  list: (projectId: string) => ["images", "list", projectId] as const,
};

export function useImages(projectId: string | undefined) {
  return useQuery({
    queryKey: imagesKeys.list(projectId ?? ""),
    queryFn: () => imagesService.list(projectId!),
    enabled: Boolean(projectId),
    // S3 read URLs expire in 15 minutes: fetch again before that
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useUploadImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      file,
      onProgress,
      description,
    }: {
      projectId: string;
      file: File;
      onProgress?: Progress;
      description?: string | null;
    }) => imagesService.send(projectId, file, onProgress, description),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: imagesKeys.all }),
  });
}

export function useDeleteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => imagesService.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: imagesKeys.all }),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ideasService } from "./service";
import type { IdeaInput } from "./types";

export const ideasKeys = {
  all: ["ideas"] as const,
  list: (projectId: string) => ["ideas", "list", projectId] as const,
  detail: (id: string) => ["ideas", "detail", id] as const,
};

export function useIdeas(projectId: string | undefined) {
  return useQuery({
    queryKey: ideasKeys.list(projectId ?? ""),
    queryFn: () => ideasService.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useIdea(id: string | null | undefined) {
  return useQuery({
    queryKey: ideasKeys.detail(id ?? ""),
    queryFn: () => ideasService.get(id!),
    enabled: Boolean(id),
  });
}

export function useCreateIdea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: IdeaInput;
    }) => ideasService.create(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ideasKeys.all }),
  });
}

export function useUpdateIdea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: IdeaInput }) =>
      ideasService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ideasKeys.all }),
  });
}

export function useDeleteIdea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ideasService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ideasKeys.all }),
  });
}

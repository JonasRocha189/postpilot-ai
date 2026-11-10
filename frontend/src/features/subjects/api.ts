import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subjectsService } from "./service";
import type { SubjectInput } from "./types";

export const subjectsKeys = {
  all: ["subjects"] as const,
  list: (projectId: string) => ["subjects", "list", projectId] as const,
  detail: (id: string) => ["subjects", "detail", id] as const,
};

export function useSubjects(projectId: string | undefined) {
  return useQuery({
    queryKey: subjectsKeys.list(projectId ?? ""),
    queryFn: () => subjectsService.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useSubject(id: string | undefined) {
  return useQuery({
    queryKey: subjectsKeys.detail(id ?? ""),
    queryFn: () => subjectsService.get(id!),
    enabled: Boolean(id),
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: SubjectInput;
    }) => subjectsService.create(projectId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: subjectsKeys.all }),
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SubjectInput }) =>
      subjectsService.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: subjectsKeys.all }),
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => subjectsService.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: subjectsKeys.all }),
  });
}

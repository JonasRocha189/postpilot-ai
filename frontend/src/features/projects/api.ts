import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsService } from "./service";
import type { ProjectInput } from "./types";

export const projectsKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: projectsKeys.all,
    queryFn: () => projectsService.list(),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectsKeys.detail(id ?? ""),
    queryFn: () => projectsService.get(id!),
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) => projectsService.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKeys.all }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProjectInput }) =>
      projectsService.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKeys.all }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsService.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKeys.all }),
  });
}

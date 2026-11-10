import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { imagesKeys } from "@/features/images/api";
import { metricsKeys } from "@/features/metrics/api";
import { postsService } from "./service";
import type { PostFilters, PostInput } from "./types";

export const postsKeys = {
  all: ["posts"] as const,
  list: (projectId: string, filters: PostFilters) =>
    ["posts", "list", projectId, filters] as const,
  detail: (id: string) => ["posts", "detail", id] as const,
};

export function usePosts(
  projectId: string | undefined,
  filters: PostFilters = {},
) {
  return useQuery({
    queryKey: postsKeys.list(projectId ?? "", filters),
    queryFn: () => postsService.list(projectId!, filters),
    enabled: Boolean(projectId),
    // When the filter or calendar month changes, keep the previous list until the new one arrives
    placeholderData: keepPreviousData,
  });
}

export function usePost(id: string | undefined) {
  return useQuery({
    queryKey: postsKeys.detail(id ?? ""),
    queryFn: () => postsService.get(id!),
    enabled: Boolean(id),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) => postsService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postsKeys.all }),
  });
}

/** Removed variations take their images and metrics with them. */
function invalidatePostsAndDependents(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: postsKeys.all }),
    queryClient.invalidateQueries({ queryKey: imagesKeys.all }),
    queryClient.invalidateQueries({ queryKey: metricsKeys.all }),
  ]);
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PostInput }) =>
      postsService.update(id, input),
    onSuccess: () => invalidatePostsAndDependents(queryClient),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postsService.remove(id),
    onSuccess: () => invalidatePostsAndDependents(queryClient),
  });
}

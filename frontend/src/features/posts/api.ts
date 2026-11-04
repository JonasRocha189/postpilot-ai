import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { imagensKeys } from "@/features/imagens/api";
import { metricasKeys } from "@/features/metricas/api";
import { postsService } from "./service";
import type { PostFiltros, PostInput } from "./types";

export const postsKeys = {
  all: ["posts"] as const,
  list: (projetoId: string, filtros: PostFiltros) =>
    ["posts", "list", projetoId, filtros] as const,
  detail: (id: string) => ["posts", "detail", id] as const,
};

export function usePosts(
  projetoId: string | undefined,
  filtros: PostFiltros = {},
) {
  return useQuery({
    queryKey: postsKeys.list(projetoId ?? "", filtros),
    queryFn: () => postsService.listar(projetoId!, filtros),
    enabled: Boolean(projetoId),
    // Ao trocar filtro ou mês do calendário, mantém a lista anterior até chegar a nova
    placeholderData: keepPreviousData,
  });
}

export function usePost(id: string | undefined) {
  return useQuery({
    queryKey: postsKeys.detail(id ?? ""),
    queryFn: () => postsService.obter(id!),
    enabled: Boolean(id),
  });
}

export function useCriarPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) => postsService.criar(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postsKeys.all }),
  });
}

/** Variações removidas levam junto as imagens e as métricas. */
function invalidarPostsEDependentes(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: postsKeys.all }),
    queryClient.invalidateQueries({ queryKey: imagensKeys.all }),
    queryClient.invalidateQueries({ queryKey: metricasKeys.all }),
  ]);
}

export function useAtualizarPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PostInput }) =>
      postsService.atualizar(id, input),
    onSuccess: () => invalidarPostsEDependentes(queryClient),
  });
}

export function useExcluirPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postsService.excluir(id),
    onSuccess: () => invalidarPostsEDependentes(queryClient),
  });
}

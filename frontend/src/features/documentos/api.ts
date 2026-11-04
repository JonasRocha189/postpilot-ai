import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentosService, type Progresso } from "./service";

export const documentosKeys = {
  all: ["documentos"] as const,
  list: (projetoId: string) => ["documentos", "list", projetoId] as const,
};

export function useDocumentos(projetoId: string | undefined) {
  return useQuery({
    queryKey: documentosKeys.list(projetoId ?? ""),
    queryFn: () => documentosService.listar(projetoId!),
    enabled: Boolean(projetoId),
    // Enquanto algum documento estiver em processamento, consulta de novo
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === "pending" || d.status === "processing")
        ? 1500
        : false,
  });
}

export function useEnviarDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projetoId,
      arquivo,
      onProgress,
    }: {
      projetoId: string;
      arquivo: File;
      onProgress?: Progresso;
    }) => documentosService.enviar(projetoId, arquivo, onProgress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentosKeys.all }),
  });
}

export function useExcluirDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentosService.excluir(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentosKeys.all }),
  });
}

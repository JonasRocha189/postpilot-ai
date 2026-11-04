import type { Progresso } from "@/lib/api/s3";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { imagensService } from "./service";

export const imagensKeys = {
  all: ["imagens"] as const,
  list: (projetoId: string) => ["imagens", "list", projetoId] as const,
};

export function useImagens(projetoId: string | undefined) {
  return useQuery({
    queryKey: imagensKeys.list(projetoId ?? ""),
    queryFn: () => imagensService.listar(projetoId!),
    enabled: Boolean(projetoId),
    // As URLs de leitura do S3 expiram em 15 minutos: busca de novo antes disso
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useEnviarImagem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projetoId,
      arquivo,
      onProgress,
      descricao,
    }: {
      projetoId: string;
      arquivo: File;
      onProgress?: Progresso;
      descricao?: string | null;
    }) => imagensService.enviar(projetoId, arquivo, onProgress, descricao),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: imagensKeys.all }),
  });
}

export function useExcluirImagem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => imagensService.excluir(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: imagensKeys.all }),
  });
}

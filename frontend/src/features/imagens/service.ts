import { ApiError, apiFetch, apiMode } from "@/lib/api/http";
import { putNoS3, type Progresso } from "@/lib/api/s3";
import { MIME_POR_TIPO, tipoDaImagem } from "./arquivo";
import { imagensMock } from "./mock";
import type { Imagem, ImagemUploadUrlResponse } from "./types";

export interface ImagensService {
  /** Biblioteca de imagens do projeto, das mais recentes para as mais antigas. */
  listar(projetoId: string): Promise<Imagem[]>;
  /**
   * Fluxo completo de envio: pede a URL pré-assinada, envia o arquivo
   * direto para o S3 e registra a imagem na biblioteca do projeto.
   */
  enviar(
    projetoId: string,
    arquivo: File,
    onProgress?: Progresso,
    /** Texto alternativo (ex.: o texto da arte criada no editor) */
    descricao?: string | null,
  ): Promise<Imagem>;
  /** Remove a imagem e o objeto no S3. Rejeita com 409 se algum post a usa. */
  excluir(id: string): Promise<void>;
}

const imagensHttp: ImagensService = {
  listar: (projetoId) =>
    apiFetch<Imagem[]>(
      `/images?${new URLSearchParams({ project_id: projetoId })}`,
    ),

  async enviar(projetoId, arquivo, onProgress, descricao) {
    const tipo = tipoDaImagem(arquivo);
    if (!tipo) throw new ApiError(422, "Unsupported image type");
    const content_type = MIME_POR_TIPO[tipo];

    const { key, upload_url } = await apiFetch<ImagemUploadUrlResponse>(
      "/images/upload-url",
      {
        method: "POST",
        body: JSON.stringify({
          project_id: projetoId,
          content_type,
          size_bytes: arquivo.size,
        }),
      },
    );
    await putNoS3(upload_url, arquivo, content_type, onProgress);
    return apiFetch<Imagem>("/images", {
      method: "POST",
      body: JSON.stringify({
        project_id: projetoId,
        key,
        content_type,
        description: descricao?.trim() || null,
      }),
    });
  },

  excluir: (id) => apiFetch<void>(`/images/${id}`, { method: "DELETE" }),
};

export const imagensService: ImagensService =
  apiMode === "mock" ? imagensMock : imagensHttp;

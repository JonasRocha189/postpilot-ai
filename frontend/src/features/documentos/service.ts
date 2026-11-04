import { ApiError, apiFetch, apiMode } from "@/lib/api/http";
import { putNoS3, type Progresso } from "@/lib/api/s3";
import { documentosMock } from "./mock";
import type { Documento, UploadUrlResponse } from "./types";
import { MIME_POR_TIPO, tipoDoArquivo } from "./validacao";

export type { Progresso };

export interface DocumentosService {
  listar(projetoId: string): Promise<Documento[]>;
  /**
   * Fluxo completo de envio: pede a URL pré-assinada, envia o arquivo
   * direto para o S3 e avisa o backend para processar.
   */
  enviar(
    projetoId: string,
    arquivo: File,
    onProgress?: Progresso,
  ): Promise<Documento>;
  /** Remove o documento, o objeto no S3 e os chunks. */
  excluir(id: string): Promise<void>;
}

const documentosHttp: DocumentosService = {
  listar: (projetoId) =>
    apiFetch<Documento[]>(
      `/documents?${new URLSearchParams({ project_id: projetoId })}`,
    ),

  async enviar(projetoId, arquivo, onProgress) {
    const tipo = tipoDoArquivo(arquivo.name);
    if (!tipo) throw new ApiError(422, "Tipo de arquivo não aceito");

    const { documento, upload_url } = await apiFetch<UploadUrlResponse>(
      "/documents/upload-url",
      {
        method: "POST",
        body: JSON.stringify({
          project_id: projetoId,
          name: arquivo.name,
          tipo,
          tamanho_bytes: arquivo.size,
        }),
      },
    );
    await putNoS3(upload_url, arquivo, MIME_POR_TIPO[tipo], onProgress);
    return apiFetch<Documento>(`/documents/${documento.id}/process`, {
      method: "POST",
    });
  },

  excluir: (id) => apiFetch<void>(`/documents/${id}`, { method: "DELETE" }),
};

export const documentosService: DocumentosService =
  apiMode === "mock" ? documentosMock : documentosHttp;

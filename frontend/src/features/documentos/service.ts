import { ApiError, apiFetch, apiMode } from "@/lib/api/http";
import { putNoS3, type Progresso } from "@/lib/api/s3";
import { documentosMock } from "./mock";
import type { ProjectDocument, UploadUrlResponse } from "./types";
import { MIME_POR_TIPO, tipoDoArquivo } from "./validacao";

export type { Progresso };

export interface DocumentosService {
  listar(projetoId: string): Promise<ProjectDocument[]>;
  /**
   * Fluxo completo de envio: pede a URL pré-assinada, envia o arquivo
   * direto para o S3 e avisa o backend para processar.
   */
  enviar(
    projetoId: string,
    arquivo: File,
    onProgress?: Progresso,
  ): Promise<ProjectDocument>;
  /** Remove o documento, o objeto no S3 e os chunks. */
  excluir(id: string): Promise<void>;
}

const documentosHttp: DocumentosService = {
  listar: (projetoId) =>
    apiFetch<ProjectDocument[]>(
      `/documents?${new URLSearchParams({ project_id: projetoId })}`,
    ),

  async enviar(projetoId, arquivo, onProgress) {
    const type = tipoDoArquivo(arquivo.name);
    if (!type) throw new ApiError(422, "Tipo de arquivo não aceito");

    const { document, upload_url } = await apiFetch<UploadUrlResponse>(
      "/documents/upload-url",
      {
        method: "POST",
        body: JSON.stringify({
          project_id: projetoId,
          name: arquivo.name,
          type,
          size_bytes: arquivo.size,
        }),
      },
    );
    await putNoS3(upload_url, arquivo, MIME_POR_TIPO[type], onProgress);
    return apiFetch<ProjectDocument>(`/documents/${document.id}/process`, {
      method: "POST",
    });
  },

  excluir: (id) => apiFetch<void>(`/documents/${id}`, { method: "DELETE" }),
};

export const documentosService: DocumentosService =
  apiMode === "mock" ? documentosMock : documentosHttp;

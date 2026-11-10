import { ApiError, apiFetch, apiMode } from "@/lib/api/http";
import { putNoS3, type Progress } from "@/lib/api/s3";
import { documentsMock } from "./mock";
import type { ProjectDocument, UploadUrlResponse } from "./types";
import { MIME_BY_TYPE, fileType } from "./validation";

export type { Progress };

export interface DocumentsService {
  list(projectId: string): Promise<ProjectDocument[]>;
  /**
   * Full upload flow: asks for the presigned URL, uploads the file straight
   * to S3 and tells the backend to process it.
   */
  send(
    projectId: string,
    file: File,
    onProgress?: Progress,
  ): Promise<ProjectDocument>;
  /** Removes the document, the S3 object and the chunks. */
  remove(id: string): Promise<void>;
}

const documentsHttp: DocumentsService = {
  list: (projectId) =>
    apiFetch<ProjectDocument[]>(
      `/documents?${new URLSearchParams({ project_id: projectId })}`,
    ),

  async send(projectId, file, onProgress) {
    const type = fileType(file.name);
    if (!type) throw new ApiError(422, "Tipo de arquivo não aceito");

    const { document, upload_url } = await apiFetch<UploadUrlResponse>(
      "/documents/upload-url",
      {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          name: file.name,
          type,
          size_bytes: file.size,
        }),
      },
    );
    await putNoS3(upload_url, file, MIME_BY_TYPE[type], onProgress);
    return apiFetch<ProjectDocument>(`/documents/${document.id}/process`, {
      method: "POST",
    });
  },

  remove: (id) => apiFetch<void>(`/documents/${id}`, { method: "DELETE" }),
};

export const documentsService: DocumentsService =
  apiMode === "mock" ? documentsMock : documentsHttp;

import { ApiError, apiFetch, apiMode } from "@/lib/api/http";
import { putNoS3, type Progress } from "@/lib/api/s3";
import { MIME_BY_TYPE, imageType } from "./file";
import { imagesMock } from "./mock";
import type { Image, ImageUploadUrlResponse } from "./types";

export interface ImagesService {
  /** The project's image library, newest first. */
  list(projectId: string): Promise<Image[]>;
  /**
   * Full upload flow: asks for the presigned URL, uploads the file straight
   * to S3 and registers the image in the project library.
   */
  send(
    projectId: string,
    file: File,
    onProgress?: Progress,
    /** Alt text (e.g. the text of the artwork made in the editor) */
    description?: string | null,
  ): Promise<Image>;
  /** Removes the image and the S3 object. Rejects with 409 if any post uses it. */
  remove(id: string): Promise<void>;
}

const imagesHttp: ImagesService = {
  list: (projectId) =>
    apiFetch<Image[]>(
      `/images?${new URLSearchParams({ project_id: projectId })}`,
    ),

  async send(projectId, file, onProgress, description) {
    const type = imageType(file);
    if (!type) throw new ApiError(422, "Unsupported image type");
    const content_type = MIME_BY_TYPE[type];

    const { key, upload_url } = await apiFetch<ImageUploadUrlResponse>(
      "/images/upload-url",
      {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          content_type,
          size_bytes: file.size,
        }),
      },
    );
    await putNoS3(upload_url, file, content_type, onProgress);
    return apiFetch<Image>("/images", {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        key,
        content_type,
        description: description?.trim() || null,
      }),
    });
  },

  remove: (id) => apiFetch<void>(`/images/${id}`, { method: "DELETE" }),
};

export const imagesService: ImagesService =
  apiMode === "mock" ? imagesMock : imagesHttp;

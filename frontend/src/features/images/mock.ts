// FAKE images API (see lib/api/mockDb.ts). The "URL" is a data URL
// of a scaled-down copy of the image, to fit in localStorage.
import { ApiError } from "@/lib/api/http";
import { nowIso, latency, mockDb } from "@/lib/api/mockDb";
import { MAX_SIZE, imageType } from "./file";
import type { ImagesService } from "./service";

const MAX_SIDE = 640;

/** Scales the image down and returns a JPEG data URL. */
async function shrink(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

export const imagesMock: ImagesService = {
  async list(projectId) {
    await latency();
    mockDb.projects.find(projectId, "Projeto");
    return mockDb.images
      .todos()
      .filter((i) => i.project_id === projectId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async send(projectId, file, onProgress, description) {
    mockDb.projects.find(projectId, "Projeto");
    if (!imageType(file)) throw new ApiError(422, "Unsupported image type");
    if (file.size > MAX_SIZE) throw new ApiError(422, "Image is too large");

    // Simulates the S3 PUT with progress
    for (const fraction of [0.2, 0.5, 0.8, 1]) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      onProgress?.(fraction);
    }

    const now = nowIso();
    return mockDb.images.insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      content_type: file.type,
      description: description?.trim() || null,
      url: await shrink(file),
      created_at: now,
      updated_at: now,
    });
  },

  async remove(id) {
    await latency();
    mockDb.images.find(id, "Imagem");
    // API rule: an image used by any post variation can't be deleted
    if (
      mockDb.posts
        .todos()
        .some((p) => p.variations.some((v) => v.image_ids.includes(id)))
    ) {
      throw new ApiError(409, "Image is used by posts");
    }
    mockDb.images.remove(id);
  },
};

// FAKE documents API (see lib/api/mockDb.ts). It doesn't keep the file:
// it only simulates the upload and processing (pending → processing → ready/error).
// Empty files or files with "error" in the name end with status "error".
import { ApiError } from "@/lib/api/http";
import { nowIso, latency, mockDb, type MockDocument } from "@/lib/api/mockDb";
import type { DocumentsService } from "./service";
import type { ProjectDocument } from "./types";
import { MAX_SIZE, fileType } from "./validation";

const PROCESSING_TIME_MS = 3500;

/** Moves the status forward as time goes by, like the backend would in the background. */
function update(doc: MockDocument): MockDocument {
  if (doc.status !== "processing" || !doc.processing_started_at) return doc;
  const elapsed = Date.now() - new Date(doc.processing_started_at).getTime();
  if (elapsed < PROCESSING_TIME_MS) return doc;

  const failed =
    doc.size_bytes === 0 || doc.name.toLowerCase().includes("error");
  return mockDb.documents.replace({
    ...doc,
    status: failed ? "error" : "ready",
    error_message: failed ? "Não foi possível extrair texto do arquivo" : null,
    chunk_count: failed
      ? null
      : Math.max(1, Math.round(doc.size_bytes / 30_000)),
    updated_at: nowIso(),
  });
}

const audience = ({
  processing_started_at: _ignored,
  ...doc
}: MockDocument): ProjectDocument => {
  void _ignored;
  return doc;
};

export const documentsMock: DocumentsService = {
  async list(projectId) {
    await latency();
    mockDb.projects.find(projectId, "Projeto");
    return mockDb.documents
      .todos()
      .filter((d) => d.project_id === projectId)
      .map(update)
      .map(audience)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async send(projectId, file, onProgress) {
    mockDb.projects.find(projectId, "Projeto");
    const type = fileType(file.name);
    if (!type) throw new ApiError(422, "Tipo de arquivo não aceito");
    if (file.size > MAX_SIZE)
      throw new ApiError(422, "Arquivo maior que o permitido");

    // Simulates the S3 PUT with progress
    for (const fraction of [0.15, 0.4, 0.7, 1]) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      onProgress?.(fraction);
    }

    const now = nowIso();
    const doc = mockDb.documents.insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      name: file.name,
      type,
      size_bytes: file.size,
      status: "processing",
      error_message: null,
      chunk_count: null,
      created_at: now,
      updated_at: now,
      processing_started_at: now,
    });
    return audience(doc);
  },

  async remove(id) {
    await latency();
    mockDb.documents.find(id, "ProjectDocument");
    mockDb.documents.remove(id);
  },
};

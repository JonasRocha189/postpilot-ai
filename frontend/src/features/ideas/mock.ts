// FAKE ideas API (see lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { agoraIso, latencia, mockDb } from "@/lib/api/mockDb";
import type { IdeasService } from "./service";
import type { IdeaInput } from "./types";

const NAME = "Idea";

/** Like the backend: the subject (if any) belongs to the idea's project. */
function checkSubject(projectId: string, subjectId: string | null) {
  if (!subjectId) return;
  const subject = mockDb.assuntos.todos().find((s) => s.id === subjectId);
  if (subject?.project_id !== projectId) {
    throw new ApiError(422, "Subject is not in this project");
  }
}

const clean = (input: IdeaInput) => ({
  title: input.title.trim(),
  notes: input.notes?.trim() || null,
  subject_id: input.subject_id || null,
  networks: [...new Set(input.networks)],
});

export const ideasMock: IdeasService = {
  async list(projectId) {
    await latencia();
    return mockDb.ideas
      .todos()
      .filter((i) => i.project_id === projectId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async get(id) {
    await latencia();
    return mockDb.ideas.encontrar(id, NAME);
  },

  async create(projectId, input) {
    await latencia();
    mockDb.projetos.encontrar(projectId, "Project");
    checkSubject(projectId, input.subject_id);
    const now = agoraIso();
    return mockDb.ideas.inserir({
      ...clean(input),
      id: crypto.randomUUID(),
      project_id: projectId,
      source: "manual",
      post_id: null,
      created_at: now,
      updated_at: now,
    });
  },

  async update(id, input) {
    await latencia();
    const current = mockDb.ideas.encontrar(id, NAME);
    checkSubject(current.project_id, input.subject_id);
    return mockDb.ideas.substituir({
      ...current,
      ...clean(input),
      post_id: input.post_id === undefined ? current.post_id : input.post_id,
      updated_at: agoraIso(),
    });
  },

  async remove(id) {
    await latencia();
    mockDb.ideas.encontrar(id, NAME);
    mockDb.ideas.remover(id);
  },
};

// FAKE subjects API (see lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { nowIso, latency, mockDb } from "@/lib/api/mockDb";
import type { SubjectsService } from "./service";

const ENTITY = "Assunto";

export const subjectsMock: SubjectsService = {
  async list(projectId) {
    await latency();
    mockDb.projects.find(projectId, "Projeto");
    return mockDb.subjects
      .todos()
      .filter((a) => a.project_id === projectId)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id) {
    await latency();
    return mockDb.subjects.find(id, ENTITY);
  },

  async create(projectId, input) {
    await latency();
    mockDb.projects.find(projectId, "Projeto");
    const now = nowIso();
    return mockDb.subjects.insert({
      ...input,
      id: crypto.randomUUID(),
      project_id: projectId,
      created_at: now,
      updated_at: now,
    });
  },

  async update(id, input) {
    await latency();
    const current = mockDb.subjects.find(id, ENTITY);
    return mockDb.subjects.replace({
      ...current,
      ...input,
      updated_at: nowIso(),
    });
  },

  async remove(id) {
    await latency();
    mockDb.subjects.find(id, ENTITY);
    // API rule: only deletes a subject with no posts
    if (mockDb.posts.todos().some((p) => p.subject_id === id)) {
      throw new ApiError(409, "O assunto ainda tem posts");
    }
    mockDb.subjects.remove(id);
  },
};

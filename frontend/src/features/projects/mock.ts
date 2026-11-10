// FAKE projects API (see lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { nowIso, latency, mockDb } from "@/lib/api/mockDb";
import type { ProjectsService } from "./service";
import type { Project } from "./types";

const ENTITY = "Projeto";

// Returns only the public fields (old mock data could have extra fields)
const audience = (p: Project): Project => ({
  id: p.id,
  name: p.name,
  description: p.description,
  target_audience: p.target_audience,
  voice_tone: p.voice_tone,
  created_at: p.created_at,
  updated_at: p.updated_at,
});

export const projectsMock: ProjectsService = {
  async list() {
    await latency();
    return mockDb.projects
      .todos()
      .map(audience)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id) {
    await latency();
    return audience(mockDb.projects.find(id, ENTITY));
  },

  async create(input) {
    await latency();
    const now = nowIso();
    return audience(
      mockDb.projects.insert({
        ...input,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      }),
    );
  },

  async update(id, input) {
    await latency();
    const current = mockDb.projects.find(id, ENTITY);
    return audience(
      mockDb.projects.replace({ ...current, ...input, updated_at: nowIso() }),
    );
  },

  async remove(id) {
    await latency();
    mockDb.projects.find(id, ENTITY);
    // API rule: only deletes a project with no subjects, documents or images
    if (
      mockDb.subjects.todos().some((a) => a.project_id === id) ||
      mockDb.documents.todos().some((d) => d.project_id === id) ||
      mockDb.images.todos().some((i) => i.project_id === id)
    ) {
      throw new ApiError(409, "Project has subjects, documents or images");
    }
    mockDb.projects.remove(id);
  },
};

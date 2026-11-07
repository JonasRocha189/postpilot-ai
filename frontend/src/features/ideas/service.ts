import { apiFetch, apiMode } from "@/lib/api/http";
import { ideasMock } from "./mock";
import type { Idea, IdeaInput } from "./types";

export interface IdeasService {
  /** Ideas of the project, newest first. */
  list(projectId: string): Promise<Idea[]>;
  get(id: string): Promise<Idea>;
  create(projectId: string, input: IdeaInput): Promise<Idea>;
  /** Replaces the idea (title, notes, subject, networks and post_id). */
  update(id: string, input: IdeaInput): Promise<Idea>;
  remove(id: string): Promise<void>;
}

const ideasHttp: IdeasService = {
  list: (projectId) =>
    apiFetch<Idea[]>(
      `/ideas?${new URLSearchParams({ project_id: projectId })}`,
    ),
  get: (id) => apiFetch<Idea>(`/ideas/${id}`),
  create: (projectId, input) =>
    apiFetch<Idea>("/ideas", {
      method: "POST",
      body: JSON.stringify({ ...input, project_id: projectId }),
    }),
  update: (id, input) =>
    apiFetch<Idea>(`/ideas/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id) => apiFetch<void>(`/ideas/${id}`, { method: "DELETE" }),
};

export const ideasService: IdeasService =
  apiMode === "mock" ? ideasMock : ideasHttp;

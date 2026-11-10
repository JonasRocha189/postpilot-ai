import { apiFetch, apiMode } from "@/lib/api/http";
import { projectsMock } from "./mock";
import type { Project, ProjectInput } from "./types";

export interface ProjectsService {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project>;
  create(input: ProjectInput): Promise<Project>;
  update(id: string, input: ProjectInput): Promise<Project>;
  /** Rejects with ApiError 409 when the project still has subjects, documents or images. */
  remove(id: string): Promise<void>;
}

const projectsHttp: ProjectsService = {
  list: () => apiFetch<Project[]>("/projects"),
  get: (id) => apiFetch<Project>(`/projects/${id}`),
  create: (input) =>
    apiFetch<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id, input) =>
    apiFetch<Project>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id) => apiFetch<void>(`/projects/${id}`, { method: "DELETE" }),
};

export const projectsService: ProjectsService =
  apiMode === "mock" ? projectsMock : projectsHttp;

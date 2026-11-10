import { apiFetch, apiMode } from "@/lib/api/http";
import { subjectsMock } from "./mock";
import type { Subject, SubjectInput } from "./types";

export interface SubjectsService {
  list(projectId: string): Promise<Subject[]>;
  get(id: string): Promise<Subject>;
  create(projectId: string, input: SubjectInput): Promise<Subject>;
  update(id: string, input: SubjectInput): Promise<Subject>;
  /** Rejects with ApiError 409 when the subject still has posts. */
  remove(id: string): Promise<void>;
}

const subjectsHttp: SubjectsService = {
  list: (projectId) =>
    apiFetch<Subject[]>(
      `/subjects?${new URLSearchParams({ project_id: projectId })}`,
    ),
  get: (id) => apiFetch<Subject>(`/subjects/${id}`),
  create: (projectId, input) =>
    apiFetch<Subject>("/subjects", {
      method: "POST",
      body: JSON.stringify({ ...input, project_id: projectId }),
    }),
  update: (id, input) =>
    apiFetch<Subject>(`/subjects/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id) => apiFetch<void>(`/subjects/${id}`, { method: "DELETE" }),
};

export const subjectsService: SubjectsService =
  apiMode === "mock" ? subjectsMock : subjectsHttp;

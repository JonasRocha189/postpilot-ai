import { apiFetch, apiMode } from "@/lib/api/http";
import { postsMock } from "./mock";
import type { Post, PostFilters, PostInput } from "./types";

export interface PostsService {
  list(projectId: string, filters?: PostFilters): Promise<Post[]>;
  get(id: string): Promise<Post>;
  create(input: PostInput): Promise<Post>;
  /** Replaces the post and all its variations. */
  update(id: string, input: PostInput): Promise<Post>;
  remove(id: string): Promise<void>;
}

function query(projectId: string, filters: PostFilters = {}) {
  const params = new URLSearchParams({ project_id: projectId });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

const postsHttp: PostsService = {
  list: (projectId, filters) =>
    apiFetch<Post[]>(`/posts?${query(projectId, filters)}`),
  get: (id) => apiFetch<Post>(`/posts/${id}`),
  create: (input) =>
    apiFetch<Post>("/posts", { method: "POST", body: JSON.stringify(input) }),
  update: (id, input) =>
    apiFetch<Post>(`/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id) => apiFetch<void>(`/posts/${id}`, { method: "DELETE" }),
};

export const postsService: PostsService =
  apiMode === "mock" ? postsMock : postsHttp;

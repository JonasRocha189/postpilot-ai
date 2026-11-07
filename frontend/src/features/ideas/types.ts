import type { Rede } from "@/lib/dominio";

// Mirrors the backend schema (see _docs/api.md).

/** Who wrote the idea: the user or the agent (Ideation mode). */
export type IdeaSource = "manual" | "agent";

/** A possible post, before it is written: the Ideas page lists them. */
export type Idea = {
  id: string;
  project_id: string;
  title: string;
  notes: string | null;
  /** Optional: an idea may not have a subject yet */
  subject_id: string | null;
  /** Networks suggested for the post (may be empty) */
  networks: Rede[];
  source: IdeaSource;
  /** The post created from this idea; null while the idea is open */
  post_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Body of POST /ideas (plus project_id) and PUT /ideas/{id}. */
export type IdeaInput = Pick<
  Idea,
  "title" | "notes" | "subject_id" | "networks"
> & {
  /** Set when a post is created from the idea (PUT only) */
  post_id?: string | null;
};

// Mirrors the backend schema (see _docs/modelo-de-dados.md and _docs/api.md)
export type Subject = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  /** null = uses the project's */
  target_audience: string | null;
  /** null = uses the project's */
  voice_tone: string | null;
  created_at: string;
  updated_at: string;
};

/** Body of POST /subjects (with project_id) and PUT /subjects/{id} */
export type SubjectInput = Pick<
  Subject,
  "name" | "description" | "target_audience" | "voice_tone"
>;

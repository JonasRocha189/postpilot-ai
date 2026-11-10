// Mirrors the backend schema (see _docs/modelo-de-dados.md and _docs/api.md)
export type Project = {
  id: string;
  name: string;
  description: string | null;
  target_audience: string | null;
  voice_tone: string | null;
  created_at: string; // ISO
  updated_at: string; // ISO
};

/** Corpo de POST /projects e PUT /projects/{id} */
export type ProjectInput = Pick<
  Project,
  "name" | "description" | "target_audience" | "voice_tone"
>;

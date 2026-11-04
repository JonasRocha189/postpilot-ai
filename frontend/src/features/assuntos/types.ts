// Espelha o schema do backend (ver docs/modelo-de-dados.md e docs/api.md)
export type Assunto = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  /** null = usa o do projeto */
  target_audience: string | null;
  /** null = usa o do projeto */
  voice_tone: string | null;
  created_at: string;
  updated_at: string;
};

/** Corpo de POST /subjects (com project_id) e PUT /subjects/{id} */
export type AssuntoInput = Pick<
  Assunto,
  "name" | "description" | "target_audience" | "voice_tone"
>;

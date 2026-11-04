// Espelha o schema do backend (ver docs/modelo-de-dados.md e docs/api.md)
export type Projeto = {
  id: string;
  name: string;
  description: string | null;
  target_audience: string | null;
  voice_tone: string | null;
  created_at: string; // ISO
  updated_at: string; // ISO
};

/** Corpo de POST /projects e PUT /projects/{id} */
export type ProjetoInput = Pick<
  Projeto,
  "name" | "description" | "target_audience" | "voice_tone"
>;

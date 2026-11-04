import type { FormatoPost, Rede, StatusPost } from "@/lib/dominio";

// Espelha o schema do backend (ver _docs/api.md).

export type Post = {
  id: string;
  subject_id: string;
  title: string;
  content: string | null;
  status: StatusPost;
  /** Rede para a qual o post é escrito */
  network: Rede;
  format: FormatoPost;
  expected_date: string | null; // AAAA-MM-DD
  /** Imagens da biblioteca do projeto, na ordem do carrossel */
  image_ids: string[];
  created_at: string;
  updated_at: string;
};

/** Corpo de POST /posts e PUT /posts/{id} */
export type PostInput = Pick<
  Post,
  | "subject_id"
  | "title"
  | "content"
  | "status"
  | "network"
  | "format"
  | "expected_date"
  | "image_ids"
>;

/** Filtros de GET /posts (além do projeto) */
export type PostFiltros = {
  status?: StatusPost;
  subject_id?: string;
  from?: string; // AAAA-MM-DD
  to?: string;
};

import type { StatusPost } from "@/lib/dominio";

// Espelha o schema do backend (ver _docs/api.md). Sem variações por enquanto.

export type Post = {
  id: string;
  subject_id: string;
  title: string;
  content: string | null;
  status: StatusPost;
  expected_date: string | null; // AAAA-MM-DD
  /** Imagem da biblioteca do projeto (null = sem imagem) */
  image_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Corpo de POST /posts e PUT /posts/{id} */
export type PostInput = Pick<
  Post,
  "subject_id" | "title" | "content" | "status" | "expected_date" | "image_id"
>;

/** Filtros de GET /posts (além do projeto) */
export type PostFiltros = {
  status?: StatusPost;
  subject_id?: string;
  from?: string; // AAAA-MM-DD
  to?: string;
};

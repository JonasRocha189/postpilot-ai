import type { FormatoPost, Rede, StatusPost } from "@/lib/dominio";

// A scheduled variation (one network of a post), as the calendar shows it
export type PostAgendado = {
  /** Variation id (each network is its own calendar event) */
  id: string;
  postId: string;
  title: string;
  assunto: string;
  rede: Rede;
  formato: FormatoPost;
  status: StatusPost;
  dataPrevista: string; // AAAA-MM-DD
};

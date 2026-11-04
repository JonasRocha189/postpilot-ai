import type { FormatoPost, Rede, StatusPost } from "@/lib/dominio";

// Post com data prevista, no formato usado pelo calendário
export type PostAgendado = {
  id: string;
  title: string;
  assunto: string;
  rede: Rede;
  formato: FormatoPost;
  status: StatusPost;
  dataPrevista: string; // AAAA-MM-DD
};

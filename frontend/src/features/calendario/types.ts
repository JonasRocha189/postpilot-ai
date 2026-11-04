import type { StatusPost } from "@/lib/dominio";

// Post com data prevista, no formato usado pelo calendário
export type PostAgendado = {
  id: string;
  title: string;
  assunto: string;
  status: StatusPost;
  dataPrevista: string; // AAAA-MM-DD
};

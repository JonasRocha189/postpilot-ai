// Tipos do domínio compartilhados entre as features.
// Espelham os enums do backend (ver docs/modelo-de-dados.md).
// Os rótulos traduzidos ficam em locales/*/app.json, em "domain".

export type StatusPost = "draft" | "review" | "approved" | "published";

/** Ordem do ciclo de vida do post. */
export const STATUS_POST: readonly StatusPost[] = [
  "draft",
  "review",
  "approved",
  "published",
];
export type Rede = "linkedin" | "instagram" | "x";
export type ModoAgente = "ideation" | "creation";
export type StatusExecucao =
  "running" | "completed" | "error" | "limit_reached";
export type StatusDocumento = "pending" | "processing" | "ready" | "error";
/** Proporção da imagem (largura:altura) */
export type FormatoImagem = "1:1" | "4:5" | "16:9";

// Nomes de marca: iguais em todos os idiomas
export const REDE_LABEL: Record<Rede, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  x: "X",
};

export const STATUS_POST_COR = {
  draft: "light",
  review: "warning",
  approved: "info",
  published: "success",
} as const satisfies Record<StatusPost, string>;

export const STATUS_EXECUCAO_COR = {
  running: "info",
  completed: "success",
  error: "error",
  limit_reached: "warning",
} as const satisfies Record<StatusExecucao, string>;

export const STATUS_DOCUMENTO_COR = {
  pending: "light",
  processing: "info",
  ready: "success",
  error: "error",
} as const satisfies Record<StatusDocumento, string>;

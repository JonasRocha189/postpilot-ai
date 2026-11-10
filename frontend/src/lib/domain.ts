// Domain types shared by the features.
// They mirror the backend enums (see _docs/modelo-de-dados.md).
// The translated labels live in locales/*/app.json, under "domain".

export type PostStatus = "draft" | "review" | "approved" | "published";

/** Order of the post's life cycle. */
export const POST_STATUS: readonly PostStatus[] = [
  "draft",
  "review",
  "approved",
  "published",
];
export type Network = "linkedin" | "instagram" | "x";
/** How the post is published: text only, one image or several (carousel). */
export type PostFormat = "text" | "single" | "carousel";
export type AgentMode = "ideation" | "creation";
export type RunStatus = "running" | "completed" | "error" | "limit_reached";
export type DocumentStatus = "pending" | "processing" | "ready" | "error";
/** Image ratio (width:height) */
export type ImageFormat = "1:1" | "4:5" | "16:9";

// Brand names: the same in every language
export const NETWORK_LABEL: Record<Network, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  x: "X",
};

export const POST_STATUS_COLOR = {
  draft: "light",
  review: "warning",
  approved: "info",
  published: "success",
} as const satisfies Record<PostStatus, string>;

export const RUN_STATUS_COLOR = {
  running: "info",
  completed: "success",
  error: "error",
  limit_reached: "warning",
} as const satisfies Record<RunStatus, string>;

export const DOCUMENT_STATUS_COLOR = {
  pending: "light",
  processing: "info",
  ready: "success",
  error: "error",
} as const satisfies Record<DocumentStatus, string>;

import type { StatusPost } from "@/lib/dominio";

/** Cor do evento (níveis do CalendarEventItem do template) por status. */
export const STATUS_NIVEL: Record<
  StatusPost,
  "warning" | "danger" | "primary" | "success"
> = {
  draft: "warning",
  review: "danger",
  approved: "primary",
  published: "success",
};

/** Mesmas cores do CalendarEventItem, para a legenda. */
export const NIVEL_COR: Record<(typeof STATUS_NIVEL)[StatusPost], string> = {
  warning: "bg-orange-500",
  danger: "bg-error-500",
  primary: "bg-brand-500",
  success: "bg-success-500",
};

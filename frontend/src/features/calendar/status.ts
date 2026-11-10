import type { PostStatus } from "@/lib/domain";

/** Event color (the template's CalendarEventItem levels) per status. */
export const STATUS_LEVEL: Record<
  PostStatus,
  "warning" | "danger" | "primary" | "success"
> = {
  draft: "warning",
  review: "danger",
  approved: "primary",
  published: "success",
};

/** Same colors as CalendarEventItem, for the legend. */
export const LEVEL_COLOR: Record<(typeof STATUS_LEVEL)[PostStatus], string> = {
  warning: "bg-orange-500",
  danger: "bg-error-500",
  primary: "bg-brand-500",
  success: "bg-success-500",
};

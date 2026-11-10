import { cn } from "@/utils";
import type { Project } from "../types";

// A stable color per project, derived from the id
const COLORS = [
  "bg-brand-500",
  "bg-success-500",
  "bg-orange-500",
  "bg-blue-light-500",
  "bg-error-500",
  "bg-theme-purple-500",
];

// FNV-1a hash: spreads similar ids well across the colors
function colorOf(id: string) {
  let hash = 0x811c9dc5;
  for (const char of id) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return COLORS[(hash >>> 0) % COLORS.length];
}

export default function ProjectAvatar({
  project,
  className,
}: {
  project: Pick<Project, "id" | "name">;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white uppercase",
        colorOf(project.id),
        className,
      )}
    >
      {project.name.trim().charAt(0) || "?"}
    </span>
  );
}

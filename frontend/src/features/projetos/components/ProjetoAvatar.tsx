import { cn } from "@/utils";
import type { Projeto } from "../types";

// Cor estável por projeto, derivada do id
const CORES = [
  "bg-brand-500",
  "bg-success-500",
  "bg-orange-500",
  "bg-blue-light-500",
  "bg-error-500",
  "bg-theme-purple-500",
];

// Hash FNV-1a: espalha bem ids parecidos entre as cores
function corDo(id: string) {
  let hash = 0x811c9dc5;
  for (const char of id) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return CORES[(hash >>> 0) % CORES.length];
}

export default function ProjetoAvatar({
  projeto,
  className,
}: {
  projeto: Pick<Projeto, "id" | "name">;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white uppercase",
        corDo(projeto.id),
        className,
      )}
    >
      {projeto.name.trim().charAt(0) || "?"}
    </span>
  );
}

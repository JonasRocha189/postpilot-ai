import { cn } from "@/utils";

/** Card-like option (radio or checkbox inside a label) of the post form. */
export const optionClass = (selected: boolean) =>
  cn(
    "flex cursor-pointer flex-col gap-0.5 rounded-xl border px-4 py-3 text-start transition-colors has-focus-visible:ring-3 has-focus-visible:ring-brand-500/20",
    selected
      ? "border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10"
      : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700",
  );

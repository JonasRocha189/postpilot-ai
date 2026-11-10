// Classes reused by the pages' links and buttons

export const primaryLinkClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600";

export const secondaryLinkClass =
  "inline-flex items-center justify-center rounded-lg px-5 py-3.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/3";

export const iconButtonClass =
  "flex size-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white";

export const iconButtonDangerClass = `${iconButtonClass} hover:text-error-500! dark:hover:text-error-400!`;

export const cardClass =
  "rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3";

export const alertErrorClass =
  "rounded-lg border border-error-500 bg-error-50 p-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400";

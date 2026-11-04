import { FolderIcon, PlusIcon } from "@/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";
import { useProjetoAtual } from "../useProjetoAtual";

/**
 * Envolve as telas de conteúdo: sem nenhum projeto cadastrado,
 * mostra o convite para criar o primeiro no lugar da página.
 * Sem `children`, funciona como rota de layout (renderiza o <Outlet />).
 */
export default function ExigeProjeto({ children }: { children?: ReactNode }) {
  const { t } = useTranslation("app", { keyPrefix: "projects" });
  const { projetoAtual, isLoading } = useProjetoAtual();

  if (isLoading) {
    return (
      <div className="space-y-4" aria-hidden>
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  if (!projetoAtual) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-white/3">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15">
          <FolderIcon className="size-7" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-gray-800 dark:text-white/90">
          {t("empty.title")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
          {t("empty.message")}
        </p>
        <Link
          to="/projects/new"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
        >
          <PlusIcon className="size-5" />
          {t("createFirst")}
        </Link>
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}

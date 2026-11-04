import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { CheckLineIcon, ChevronDownIcon, PlusIcon, SettingsAltIcon } from "@/icons";
import { cn } from "@/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useProjetoAtual } from "../useProjetoAtual";
import ProjetoAvatar from "./ProjetoAvatar";

const linkClass =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5";

/** Seletor do projeto atual, no cabeçalho. */
export default function ProjetoSelector() {
  const { t } = useTranslation("app", { keyPrefix: "projects" });
  const { projetos, projetoAtual, selecionar, isLoading } = useProjetoAtual();
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  if (isLoading) {
    return (
      <div
        aria-hidden
        className="h-11 w-44 animate-pulse rounded-lg bg-gray-100 sm:w-56 dark:bg-gray-800"
      />
    );
  }

  if (!projetoAtual) {
    return (
      <Link
        to="/projects/new"
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
      >
        <PlusIcon className="size-5" />
        {t("createFirst")}
      </Link>
    );
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t("selectorLabel", { name: projetoAtual.name })}
        className="dropdown-toggle flex h-11 max-w-[60vw] min-w-0 items-center gap-2.5 rounded-lg border border-gray-200 bg-white ps-1.5 pe-3 text-start transition-colors hover:bg-gray-50 sm:max-w-72 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-white/3"
      >
        <ProjetoAvatar projeto={projetoAtual} />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] leading-tight text-gray-500 dark:text-gray-400">
            {t("current")}
          </span>
          <span className="block truncate text-sm leading-tight font-semibold text-gray-800 dark:text-white/90">
            {projetoAtual.name}
          </span>
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-gray-500 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={close}
        className="inset-s-0 inset-e-auto mt-2 w-72 max-w-[calc(100vw-24px)] p-2"
      >
        <p className="px-2.5 pt-1 pb-2 text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">
          {t("title")}
        </p>
        <ul role="listbox" className="custom-scrollbar flex max-h-72 flex-col gap-1 overflow-y-auto">
          {projetos.map((projeto) => {
            const isSelected = projeto.id === projetoAtual.id;
            return (
              <li key={projeto.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    selecionar(projeto.id);
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-theme-sm font-medium text-gray-700 dark:text-gray-300",
                    isSelected
                      ? "bg-brand-50 dark:bg-brand-500/15"
                      : "hover:bg-gray-100 dark:hover:bg-white/5",
                  )}
                >
                  <ProjetoAvatar projeto={projeto} className="size-7 text-xs" />
                  <span className="flex-1 truncate">{projeto.name}</span>
                  {isSelected && (
                    <CheckLineIcon className="size-4 shrink-0 text-brand-500" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-col gap-1 border-t border-gray-200 pt-2 dark:border-gray-800">
          <Link to="/projects/new" onClick={close} className={linkClass}>
            <PlusIcon className="size-5 text-gray-500 dark:text-gray-400" />
            {t("new")}
          </Link>
          <Link to="/projects" onClick={close} className={linkClass}>
            <SettingsAltIcon className="size-5 text-gray-500 dark:text-gray-400" />
            {t("manage")}
          </Link>
        </div>
      </Dropdown>
    </div>
  );
}

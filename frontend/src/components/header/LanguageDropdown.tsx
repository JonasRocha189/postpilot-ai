import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/dropdown/Dropdown";

/** Round button with the current language's flag and the language list. */
export default function LanguageDropdown({
  placement = "below",
}: {
  /** "above" for use in a footer (e.g. login screens) */
  placement?: "below" | "above";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation("app");
  const { language, currentLanguage, setLanguage, availableLanguages } =
    useLanguage();
  const CurrentFlag = currentLanguage.FlagIcon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t("language.select")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={currentLanguage.name}
        className="dropdown-toggle relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
      >
        <CurrentFlag className="size-6 overflow-hidden rounded-full" />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className={cn(
          "w-56 p-2",
          placement === "above" ? "bottom-full mb-3" : "mt-4.25",
        )}
      >
        <p className="px-2.5 pt-1 pb-2 text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">
          {t("language.label")}
        </p>
        <ul role="listbox" className="flex flex-col gap-1">
          {availableLanguages.map((lang) => {
            const isSelected = lang.id === language;
            const Flag = lang.FlagIcon;
            return (
              <li key={lang.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  lang={lang.id}
                  onClick={() => {
                    setLanguage(lang.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-theme-sm font-medium text-gray-700 transition-colors dark:text-gray-300",
                    isSelected
                      ? "bg-brand-50 dark:bg-brand-500/15"
                      : "hover:bg-gray-100 dark:hover:bg-white/5",
                  )}
                >
                  <Flag className="size-5 shrink-0 overflow-hidden rounded-full" />
                  <span className="flex-1 truncate">{lang.name}</span>
                  {isSelected && (
                    <span className="size-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Dropdown>
    </div>
  );
}

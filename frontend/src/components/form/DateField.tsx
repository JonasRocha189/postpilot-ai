import Label from "@/components/form/Label";
import { CalenderIcon, CloseIcon } from "@/icons";
import { isoDay, parseData } from "@/lib/format";
import { cn } from "@/utils";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import { Portuguese } from "flatpickr/dist/l10n/pt";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

const ARROW_PREVIOUS =
  '<svg class="stroke-current rtl:rotate-180" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 15L7.5 10L12.5 5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_NEXT =
  '<svg class="stroke-current rtl:rotate-180" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 15L12.5 10L7.5 5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Date field with a calendar (flatpickr, the same as the template).
 * Shows the date in the language's format (20/11/2026 or 11/20/2026), accepts
 * typing and gives the form "YYYY-MM-DD" (or "" without a date).
 */
export default function DateField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const { t, i18n } = useTranslation("app", { keyPrefix: "dateField" });
  const portuguese = (i18n.resolvedLanguage ?? i18n.language) === "pt-BR";
  const inputRef = useRef<HTMLInputElement>(null);
  const instance = useRef<flatpickr.Instance | null>(null);
  // onChange changes on every render; flatpickr keeps the latest one
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Recreated only when the language changes (format and month names)
  useEffect(() => {
    const fp = flatpickr(inputRef.current!, {
      dateFormat: portuguese ? "d/m/Y" : "m/d/Y",
      locale: portuguese ? Portuguese : "default",
      allowInput: true,
      // Uses flatpickr's calendar on mobile too
      disableMobile: true,
      monthSelectorType: "static",
      prevArrow: ARROW_PREVIOUS,
      nextArrow: ARROW_NEXT,
      onChange: ([data]) => onChangeRef.current(data ? isoDay(data) : ""),
    });
    instance.current = fp;
    return () => {
      fp.destroy();
      instance.current = null;
    };
  }, [portuguese]);

  // Value from outside (e.g. a loaded post, "clear")
  useEffect(() => {
    const fp = instance.current;
    if (!fp) return;
    const current = fp.selectedDates[0] ? isoDay(fp.selectedDates[0]) : "";
    if (current !== value) fp.setDate(value ? parseData(value) : [], false);
  }, [value, portuguese]);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t("placeholder")}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(
            "h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 ps-4 pe-16 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800",
          )}
        />
        <div className="absolute inset-y-0 end-3 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label={t("clear")}
              title={t("clear")}
              className="flex size-6 items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <CloseIcon className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => instance.current?.open()}
            aria-label={t("open")}
            title={t("open")}
            className="flex size-6 items-center justify-center text-gray-500 hover:text-brand-500 dark:text-gray-400"
          >
            <CalenderIcon className="size-5" />
          </button>
        </div>
      </div>
      {hint && (
        <p
          id={`${id}-hint`}
          className="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
        >
          {hint}
        </p>
      )}
    </div>
  );
}

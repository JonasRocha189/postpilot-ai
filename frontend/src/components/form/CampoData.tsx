import Label from "@/components/form/Label";
import { CalenderIcon, CloseIcon } from "@/icons";
import { diaIso, parseData } from "@/lib/format";
import { cn } from "@/utils";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import { Portuguese } from "flatpickr/dist/l10n/pt";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

const SETA_ANTERIOR =
  '<svg class="stroke-current rtl:rotate-180" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 15L7.5 10L12.5 5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SETA_PROXIMA =
  '<svg class="stroke-current rtl:rotate-180" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 15L12.5 10L7.5 5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Campo de data com calendário (flatpickr, o mesmo do template).
 * Mostra a data no formato do idioma (20/11/2026 ou 11/20/2026), aceita
 * digitar e entrega ao formulário "AAAA-MM-DD" (ou "" sem data).
 */
export default function CampoData({
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
  const portugues = (i18n.resolvedLanguage ?? i18n.language) === "pt-BR";
  const inputRef = useRef<HTMLInputElement>(null);
  const instancia = useRef<flatpickr.Instance | null>(null);
  // onChange muda a cada render; o flatpickr guarda a versão mais recente
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Recria só quando o idioma muda (formato e nomes dos meses)
  useEffect(() => {
    const fp = flatpickr(inputRef.current!, {
      dateFormat: portugues ? "d/m/Y" : "m/d/Y",
      locale: portugues ? Portuguese : "default",
      allowInput: true,
      // Usa o calendário do flatpickr também no celular
      disableMobile: true,
      monthSelectorType: "static",
      prevArrow: SETA_ANTERIOR,
      nextArrow: SETA_PROXIMA,
      onChange: ([data]) => onChangeRef.current(data ? diaIso(data) : ""),
    });
    instancia.current = fp;
    return () => {
      fp.destroy();
      instancia.current = null;
    };
  }, [portugues]);

  // Valor que vem de fora (ex.: post carregado, "limpar")
  useEffect(() => {
    const fp = instancia.current;
    if (!fp) return;
    const atual = fp.selectedDates[0] ? diaIso(fp.selectedDates[0]) : "";
    if (atual !== value) fp.setDate(value ? parseData(value) : [], false);
  }, [value, portugues]);

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
            onClick={() => instancia.current?.open()}
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

import Label from "@/components/form/Label";
import { REDE_LABEL, type Rede } from "@/lib/dominio";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  contarCaracteres,
  LIMITE_CARACTERES,
  VISIVEL_ANTES_DO_MAIS,
} from "../redes";

/**
 * Emojis mais usados em posts (marcadores, chamadas e reações). Para outros,
 * o seletor do sistema: Windows + . ou Ctrl + Cmd + Espaço no Mac.
 */
const EMOJIS = [
  "✅",
  "👉",
  "📌",
  "💡",
  "🚀",
  "🔥",
  "✨",
  "🎯",
  "📈",
  "📊",
  "💬",
  "📣",
  "🗓️",
  "⏰",
  "🔗",
  "👇",
  "➡️",
  "⚠️",
  "❌",
  "⭐",
  "💼",
  "🧠",
  "🔒",
  "☁️",
  "🎉",
  "👏",
  "🙌",
  "❤️",
  "🙂",
  "😉",
  "🤔",
  "🧵",
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
];

const botaoBarra =
  "flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 aria-expanded:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white/90 dark:aria-expanded:bg-white/5";

/**
 * Editor do texto do post: textarea com barra de ferramentas (emoji, marcador,
 * hashtag), contador pelo limite da rede e pré-visualização no feed. O texto
 * continua simples: é exatamente o que vai ser publicado.
 */
export default function EditorTexto({
  id,
  label,
  value,
  onChange,
  network,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  network: Rede;
  error?: string;
}) {
  const { t } = useTranslation("app", { keyPrefix: "posts.form.editor" });
  const fmt = useFormat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modo, setModo] = useState<"editar" | "previa">("editar");
  const [emojisAbertos, setEmojisAbertos] = useState(false);
  const [mostrarTudo, setMostrarTudo] = useState(false);
  const painelEmojis = useId();
  const contador = useId();

  const total = contarCaracteres(value, []);
  const limite = LIMITE_CARACTERES[network];
  const visivel = VISIVEL_ANTES_DO_MAIS[network];
  const excedeu = total > limite;

  // Fecha a paleta com Esc
  useEffect(() => {
    if (!emojisAbertos) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmojisAbertos(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [emojisAbertos]);

  /** Insere no cursor (ou no começo da linha) e devolve o foco ao texto. */
  const inserir = (texto: string, noInicioDaLinha = false) => {
    const el = textareaRef.current;
    const inicio = el?.selectionStart ?? value.length;
    const fim = el?.selectionEnd ?? inicio;
    let novo: string;
    let cursor: number;
    if (noInicioDaLinha) {
      const linha = value.lastIndexOf("\n", inicio - 1) + 1;
      novo = value.slice(0, linha) + texto + value.slice(linha);
      cursor = inicio + texto.length;
    } else {
      novo = value.slice(0, inicio) + texto + value.slice(fim);
      cursor = inicio + texto.length;
    }
    onChange(novo);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  };

  // Na prévia, corta onde a rede mostra o "ver mais"
  const caracteres = Array.from(value);
  const cortado =
    visivel !== null && caracteres.length > visivel && !mostrarTudo;
  const textoPrevia = cortado
    ? caracteres.slice(0, visivel!).join("").trimEnd()
    : value;

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <Label htmlFor={id} className="mb-0">
          {label}
        </Label>
        <div role="tablist" aria-label={t("mode")} className="flex gap-1">
          {(["editar", "previa"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => {
                setModo(m);
                setEmojisAbertos(false);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-theme-xs font-medium",
                modo === m
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400",
              )}
            >
              {m === "editar" ? t("edit") : t("preview")}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border shadow-theme-xs focus-within:ring-3",
          error || excedeu
            ? "border-error-500 focus-within:ring-error-500/20"
            : "border-gray-300 focus-within:border-brand-300 focus-within:ring-brand-500/20 dark:border-gray-700 dark:focus-within:border-brand-800",
        )}
      >
        {modo === "editar" ? (
          <>
            <div
              role="toolbar"
              aria-label={t("toolbar")}
              aria-controls={id}
              className="relative flex flex-wrap items-center gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-gray-800"
            >
              <button
                type="button"
                className={botaoBarra}
                aria-expanded={emojisAbertos}
                aria-controls={painelEmojis}
                onClick={() => setEmojisAbertos((aberto) => !aberto)}
                title={t("emoji")}
              >
                <span aria-hidden>🙂</span>
                <span className="sr-only">{t("emoji")}</span>
              </button>
              <button
                type="button"
                className={botaoBarra}
                onClick={() => inserir("• ", true)}
                title={t("bullet")}
              >
                <span aria-hidden>•</span>
                <span className="sr-only">{t("bullet")}</span>
              </button>
              <button
                type="button"
                className={botaoBarra}
                onClick={() => inserir("#")}
                title={t("hashtag")}
              >
                <span aria-hidden>#</span>
                <span className="sr-only">{t("hashtag")}</span>
              </button>

              {emojisAbertos && (
                <div
                  id={painelEmojis}
                  role="group"
                  aria-label={t("emojiPanel")}
                  className="absolute start-2 top-full z-20 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={t("insertEmoji", { emoji })}
                        onClick={() => {
                          inserir(emoji);
                          setEmojisAbertos(false);
                        }}
                        className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-gray-100 dark:hover:bg-white/5"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 px-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("moreEmojis")}
                  </p>
                </div>
              )}
            </div>
            <textarea
              ref={textareaRef}
              id={id}
              rows={9}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t("placeholder", { network: REDE_LABEL[network] })}
              aria-invalid={Boolean(error) || excedeu}
              aria-describedby={`${contador}${error ? ` ${id}-error` : ""}`}
              className="block w-full resize-y rounded-b-lg bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden dark:text-white/90 dark:placeholder:text-white/30"
            />
          </>
        ) : (
          <div className="p-4" aria-live="polite">
            <p className="mb-2 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              {t("previewTitle", { network: REDE_LABEL[network] })}
            </p>
            {value.trim() ? (
              <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-white/90">
                {textoPrevia}
                {cortado && (
                  <>
                    {"… "}
                    <button
                      type="button"
                      onClick={() => setMostrarTudo(true)}
                      className="font-medium text-gray-500 hover:underline dark:text-gray-400"
                    >
                      {t("seeMore")}
                    </button>
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-gray-400">{t("previewEmpty")}</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-xs text-error-500">
            {error}
          </p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {visivel !== null
              ? t("visibleHint", { count: fmt.number(visivel) })
              : t("visibleAll")}
          </p>
        )}
        <p
          id={contador}
          aria-live="polite"
          className={cn(
            "ms-auto text-theme-xs font-medium tabular-nums",
            excedeu ? "text-error-500" : "text-gray-500 dark:text-gray-400",
          )}
        >
          {t("counter", {
            count: fmt.number(total),
            limit: fmt.number(limite),
          })}
        </p>
      </div>
    </div>
  );
}

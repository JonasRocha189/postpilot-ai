import Label from "@/components/form/Label";
import { NETWORK_LABEL, type Network } from "@/lib/domain";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  countCharacters,
  CHAR_LIMIT_BY_NETWORK,
  VISIBLE_BEFORE_MORE,
} from "../networks";

/**
 * Emojis most used in posts (bullets, calls to action and reactions). For
 * others, the system picker: Windows + . or Ctrl + Cmd + Space on a Mac.
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

const barButton =
  "flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 aria-expanded:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white/90 dark:aria-expanded:bg-white/5";

/**
 * Post text editor: a textarea with a toolbar (emoji, bullet, hashtag), a
 * counter against the network's limit and a feed preview. The text stays
 * plain: it's exactly what will be published.
 */
export default function TextEditor({
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
  network: Network;
  error?: string;
}) {
  const { t } = useTranslation("app", { keyPrefix: "posts.form.editor" });
  const fmt = useFormat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [emojisOpen, setEmojisOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const emojiPanel = useId();
  const counter = useId();

  const total = countCharacters(value, []);
  const limit = CHAR_LIMIT_BY_NETWORK[network];
  const visible = VISIBLE_BEFORE_MORE[network];
  const exceeded = total > limit;

  // Esc closes the palette
  useEffect(() => {
    if (!emojisOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmojisOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [emojisOpen]);

  /** Inserts at the cursor (or at the start of the line) and gives focus back to the text. */
  const insert = (text: string, atLineStart = false) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    let newItem: string;
    let cursor: number;
    if (atLineStart) {
      const line = value.lastIndexOf("\n", start - 1) + 1;
      newItem = value.slice(0, line) + text + value.slice(line);
      cursor = start + text.length;
    } else {
      newItem = value.slice(0, start) + text + value.slice(end);
      cursor = start + text.length;
    }
    onChange(newItem);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  };

  // In the preview, cut where the network shows "see more"
  const characters = Array.from(value);
  const cut = visible !== null && characters.length > visible && !showAll;
  const previewText = cut
    ? characters.slice(0, visible!).join("").trimEnd()
    : value;

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <Label htmlFor={id} className="mb-0">
          {label}
        </Label>
        <div role="tablist" aria-label={t("mode")} className="flex gap-1">
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setEmojisOpen(false);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-theme-xs font-medium",
                mode === m
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400",
              )}
            >
              {m === "edit" ? t("edit") : t("preview")}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border shadow-theme-xs focus-within:ring-3",
          error || exceeded
            ? "border-error-500 focus-within:ring-error-500/20"
            : "border-gray-300 focus-within:border-brand-300 focus-within:ring-brand-500/20 dark:border-gray-700 dark:focus-within:border-brand-800",
        )}
      >
        {mode === "edit" ? (
          <>
            <div
              role="toolbar"
              aria-label={t("toolbar")}
              aria-controls={id}
              className="relative flex flex-wrap items-center gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-gray-800"
            >
              <button
                type="button"
                className={barButton}
                aria-expanded={emojisOpen}
                aria-controls={emojiPanel}
                onClick={() => setEmojisOpen((open) => !open)}
                title={t("emoji")}
              >
                <span aria-hidden>🙂</span>
                <span className="sr-only">{t("emoji")}</span>
              </button>
              <button
                type="button"
                className={barButton}
                onClick={() => insert("• ", true)}
                title={t("bullet")}
              >
                <span aria-hidden>•</span>
                <span className="sr-only">{t("bullet")}</span>
              </button>
              <button
                type="button"
                className={barButton}
                onClick={() => insert("#")}
                title={t("hashtag")}
              >
                <span aria-hidden>#</span>
                <span className="sr-only">{t("hashtag")}</span>
              </button>

              {emojisOpen && (
                <div
                  id={emojiPanel}
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
                          insert(emoji);
                          setEmojisOpen(false);
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
              placeholder={t("placeholder", {
                network: NETWORK_LABEL[network],
              })}
              aria-invalid={Boolean(error) || exceeded}
              aria-describedby={`${counter}${error ? ` ${id}-error` : ""}`}
              className="block w-full resize-y rounded-b-lg bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden dark:text-white/90 dark:placeholder:text-white/30"
            />
          </>
        ) : (
          <div className="p-4" aria-live="polite">
            <p className="mb-2 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              {t("previewTitle", { network: NETWORK_LABEL[network] })}
            </p>
            {value.trim() ? (
              <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-white/90">
                {previewText}
                {cut && (
                  <>
                    {"… "}
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
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
            {visible !== null
              ? t("visibleHint", { count: fmt.number(visible) })
              : t("visibleAll")}
          </p>
        )}
        <p
          id={counter}
          aria-live="polite"
          className={cn(
            "ms-auto text-theme-xs font-medium tabular-nums",
            exceeded ? "text-error-500" : "text-gray-500 dark:text-gray-400",
          )}
        >
          {t("counter", {
            count: fmt.number(total),
            limit: fmt.number(limit),
          })}
        </p>
      </div>
    </div>
  );
}

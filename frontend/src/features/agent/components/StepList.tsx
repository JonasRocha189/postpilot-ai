import { CheckLineIcon, CloseIcon } from "@/icons";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { useTranslation } from "react-i18next";
import type { AgentStep } from "../types";

/**
 * Steps of a run, by step_number. With `detailed`, also shows the tool's
 * technical name and its arguments (detail screen).
 */
export default function StepList({
  steps,
  running = false,
  detailed = false,
}: {
  steps: AgentStep[];
  running?: boolean;
  detailed?: boolean;
}) {
  const { t, i18n } = useTranslation("app", { keyPrefix: "agent" });
  const fmt = useFormat();

  const label = (tool: string) =>
    i18n.exists(`app:agent.tools.${tool}`) ? t(`tools.${tool}`) : tool;

  const duration = (ms: number | null) =>
    ms === null
      ? ""
      : ms < 1000
        ? `${fmt.number(ms)} ms`
        : `${fmt.number(Math.round(ms / 100) / 10)} s`;

  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.id} className="flex gap-3">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              step.error
                ? "bg-error-50 text-error-500 dark:bg-error-500/15"
                : "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
            )}
          >
            {step.error ? (
              <CloseIcon className="size-3.5" />
            ) : (
              <CheckLineIcon className="size-3.5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                <span className="sr-only">
                  {t("stepNumber", { n: step.step_number })}:{" "}
                </span>
                {label(step.tool)}
                {detailed && (
                  <code className="ms-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-600 dark:bg-white/5 dark:text-gray-400">
                    {step.tool}
                  </code>
                )}
              </p>
              <span className="text-theme-xs text-gray-400 tabular-nums">
                {duration(step.duration_ms)}
              </span>
            </div>
            {step.error ? (
              <p className="mt-0.5 text-sm text-error-600 dark:text-error-400">
                {step.error}
              </p>
            ) : (
              step.result_summary && (
                <p className="mt-0.5 text-sm break-words text-gray-500 dark:text-gray-400">
                  {step.result_summary}
                </p>
              )
            )}
            {detailed && Object.keys(step.arguments).length > 0 && (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-theme-xs text-brand-500 dark:text-brand-400">
                  {t("arguments")}
                </summary>
                <pre className="mt-1.5 custom-scrollbar overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-white/3 dark:text-gray-300">
                  {JSON.stringify(step.arguments, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </li>
      ))}

      {running && (
        <li className="flex items-center gap-3" role="status">
          <span className="flex size-6 shrink-0 items-center justify-center">
            <span className="size-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
          </span>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("thinking")}
          </p>
        </li>
      )}
    </ol>
  );
}

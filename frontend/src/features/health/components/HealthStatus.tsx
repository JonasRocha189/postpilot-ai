import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHealth } from "../api";
import type { HealthState } from "../service";

type Look = { dot: string; text: string; pulse?: boolean };

const LOOK: Record<HealthState | "checking", Look> = {
  checking: {
    dot: "bg-gray-400",
    text: "text-gray-500 dark:text-gray-400",
    pulse: true,
  },
  ok: { dot: "bg-success-500", text: "text-success-600 dark:text-success-500" },
  degraded: {
    dot: "bg-warning-500",
    text: "text-warning-600 dark:text-orange-400",
  },
  offline: { dot: "bg-error-500", text: "text-error-600 dark:text-error-500" },
  demo: {
    dot: "bg-blue-light-500",
    text: "text-blue-light-600 dark:text-blue-light-400",
  },
};

/** Header badge with the backend's health; opens the details (API, database, latency). */
export default function HealthStatus() {
  const { t } = useTranslation("app", { keyPrefix: "health" });
  const fmt = useFormat();
  const [isOpen, setIsOpen] = useState(false);
  const health = useHealth();
  const result = health.data;
  // First check (or a manual one) still running: Render may be waking up
  const state =
    !result || (health.isFetching && result.state === "offline")
      ? "checking"
      : result.state;
  const look = LOOK[state];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={t("label", { status: t(`state.${state}`) })}
        title={t(`state.${state}`)}
        className="dropdown-toggle flex h-11 items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 transition-colors hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
      >
        <span className="relative flex size-2.5">
          {look.pulse && (
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                look.dot,
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex size-2.5 rounded-full",
              look.dot,
            )}
          />
        </span>
        <span
          className={cn(
            "hidden text-theme-sm font-medium sm:inline",
            look.text,
          )}
        >
          {t(`short.${state}`)}
        </span>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="mt-4.25 w-72 p-4"
      >
        <p className="text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">
          {t("title")}
        </p>
        <p className={cn("mt-1 text-theme-sm font-semibold", look.text)}>
          {t(`state.${state}`)}
        </p>

        {result && result.state !== "demo" && (
          <dl className="mt-3 flex flex-col gap-2 text-theme-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">{t("api")}</dt>
              <dd className="font-medium text-gray-800 dark:text-white/90">
                {result.state === "offline"
                  ? t("noAnswer")
                  : t("latency", { ms: fmt.number(result.latencyMs ?? 0) })}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">
                {t("database")}
              </dt>
              <dd className="font-medium text-gray-800 dark:text-white/90">
                {t(`databaseState.${result.database ?? "unknown"}`)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500 dark:text-gray-400">
                {t("checkedAt")}
              </dt>
              <dd className="font-medium text-gray-800 dark:text-white/90">
                {fmt.date(result.checkedAt, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </dd>
            </div>
          </dl>
        )}

        <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
          {t(`hint.${state}`)}
        </p>

        {state !== "demo" && (
          <button
            type="button"
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
            className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-theme-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {health.isFetching ? t("checking") : t("checkNow")}
          </button>
        )}
      </Dropdown>
    </div>
  );
}

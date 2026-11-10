import Badge from "@/components/ui/badge/Badge";
import { AiIcon, ArrowRightIcon } from "@/icons";
import { RUN_STATUS_COLOR } from "@/lib/domain";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useRun } from "../api";
import { MAX_ITERATIONS } from "../types";
import StepList from "./StepList";

/** One exchange in the conversation: the user's request and the agent working/answering. */
export default function RunCard({ id }: { id: string }) {
  const { t } = useTranslation("app");
  const { data: run, isError } = useRun(id);

  if (isError) {
    return (
      <p role="alert" className="text-sm text-error-600">
        {t("agent.loadError")}
      </p>
    );
  }
  if (!run) return null;

  const running = run.status === "running";

  return (
    <article className="space-y-4" aria-busy={running}>
      {/* Pedido */}
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-ee-md bg-brand-500 px-4 py-3 text-sm whitespace-pre-line text-white">
          {run.request}
        </p>
      </div>

      {/* Agente */}
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
          <AiIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 rounded-2xl rounded-ss-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge color="primary" size="sm">
              {t(`domain.agentMode.${run.mode}`)}
            </Badge>
            <Badge color={RUN_STATUS_COLOR[run.status]} size="sm">
              {t(`domain.runStatus.${run.status}`)}
            </Badge>
          </div>

          <StepList steps={run.steps} running={running} />

          {run.status === "completed" && run.response && (
            <div className="mt-4 border-t border-gray-100 pt-4 text-sm whitespace-pre-line text-gray-800 dark:border-gray-800 dark:text-white/90">
              {run.response}
            </div>
          )}
          {run.status === "error" && (
            <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-error-600 dark:border-gray-800 dark:text-error-400">
              {t("agent.failed")}
            </p>
          )}
          {run.status === "limit_reached" && (
            <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-warning-600 dark:border-gray-800 dark:text-orange-400">
              {t("agent.limitReached", { max: MAX_ITERATIONS })}
            </p>
          )}

          {!running && (
            <div className="mt-4 flex flex-wrap gap-2">
              {run.post_id && (
                <Link
                  to={`/posts/${run.post_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
                >
                  {t("agent.openDraft")}
                  <ArrowRightIcon className="size-4" />
                </Link>
              )}
              <Link
                to={`/agent/runs/${run.id}`}
                className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 ring-inset hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-800 dark:hover:bg-white/5"
              >
                {t("agent.viewDetails")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

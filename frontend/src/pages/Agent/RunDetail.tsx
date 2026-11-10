import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { cardClass } from "@/components/common/styles";
import Badge from "@/components/ui/badge/Badge";
import { useRun } from "@/features/agent/api";
import StepList from "@/features/agent/components/StepList";
import { MAX_ITERATIONS } from "@/features/agent/types";
import { ApiError } from "@/lib/api/http";
import { RUN_STATUS_COLOR } from "@/lib/domain";
import { useFormat } from "@/lib/format";
import NotFound from "@/pages/OtherPage/NotFound";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">
        {children}
      </dd>
    </div>
  );
}

export default function RunDetail() {
  const { id } = useParams();
  const { t } = useTranslation("app", { keyPrefix: "agent" });
  const { t: tApp } = useTranslation("app");
  const fmt = useFormat();
  const { data: run, isLoading, error } = useRun(id);

  if (error instanceof ApiError && error.status === 404) return <NotFound />;

  const duration =
    run?.finished_at &&
    (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) /
      1000;

  return (
    <>
      <PageMeta
        title={`${t("detail.title")} | PostPilot`}
        description={run?.request ?? ""}
      />
      <PageBreadcrumb pageTitle={t("detail.title")} />

      {isLoading || !run ? (
        error ? (
          <p role="alert" className="text-sm text-error-600">
            {t("loadError")}
          </p>
        ) : (
          <div
            aria-hidden
            className="h-96 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {/* Pedido e response */}
            <section className={`${cardClass} p-5 sm:p-6`}>
              <h3 className="text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">
                {t("detail.request")}
              </h3>
              <p className="mt-2 text-base whitespace-pre-line text-gray-800 dark:text-white/90">
                {run.request}
              </p>

              {run.status === "completed" && run.response && (
                <>
                  <h3 className="mt-6 text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">
                    {t("detail.answer")}
                  </h3>
                  <p className="mt-2 text-sm whitespace-pre-line text-gray-700 dark:text-gray-300">
                    {run.response}
                  </p>
                </>
              )}
              {run.status === "error" && (
                <p className="mt-6 text-sm text-error-600 dark:text-error-400">
                  {t("failed")}
                </p>
              )}
              {run.status === "limit_reached" && (
                <p className="mt-6 text-sm text-warning-600 dark:text-orange-400">
                  {t("limitReached", { max: MAX_ITERATIONS })}
                </p>
              )}
              {run.post_id && (
                <Link
                  to={`/posts/${run.post_id}`}
                  className="mt-6 inline-flex items-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
                >
                  {t("openDraft")}
                </Link>
              )}
            </section>

            {/* Passos */}
            <section className={`${cardClass} p-5 sm:p-6`}>
              <h3 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
                {t("detail.steps")}
              </h3>
              <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                {t("detail.stepsHint")}
              </p>
              {run.steps.length === 0 && run.status !== "running" ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("detail.noSteps")}
                </p>
              ) : (
                <StepList
                  steps={run.steps}
                  running={run.status === "running"}
                  detailed
                />
              )}
            </section>
          </div>

          {/* Resumo */}
          <aside className={`${cardClass} h-fit p-5 sm:p-6`}>
            <dl className="space-y-4">
              <Info label={t("detail.status")}>
                <Badge color={RUN_STATUS_COLOR[run.status]} size="sm">
                  {tApp(`domain.runStatus.${run.status}`)}
                </Badge>
              </Info>
              <Info label={t("detail.mode")}>
                {tApp(`domain.agentMode.${run.mode}`)}
              </Info>
              <Info label={t("detail.started")}>
                {fmt.date(run.started_at, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Info>
              {duration ? (
                <Info label={t("detail.duration")}>
                  {fmt.number(Math.round(duration * 10) / 10)} s
                </Info>
              ) : null}
              <Info label={t("detail.iterations")}>
                {t("detail.iterationsValue", {
                  n: run.iterations,
                  max: MAX_ITERATIONS,
                })}
              </Info>
            </dl>
            <Link
              to="/agent/runs"
              className="mt-6 inline-block text-sm text-brand-500 hover:underline dark:text-brand-400"
            >
              {t("detail.back")}
            </Link>
          </aside>
        </div>
      )}
    </>
  );
}

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { cardClass } from "@/components/common/styles";
import Badge from "@/components/ui/badge/Badge";
import { useExecucao } from "@/features/agente/api";
import PassosLista from "@/features/agente/components/PassosLista";
import { MAX_ITERACOES } from "@/features/agente/types";
import { ApiError } from "@/lib/api/http";
import { STATUS_EXECUCAO_COR } from "@/lib/dominio";
import { useFormat } from "@/lib/format";
import NotFound from "@/pages/OtherPage/NotFound";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-800 dark:text-white/90">{children}</dd>
    </div>
  );
}

export default function ExecucaoDetalhe() {
  const { id } = useParams();
  const { t } = useTranslation("app", { keyPrefix: "agent" });
  const { t: tApp } = useTranslation("app");
  const fmt = useFormat();
  const { data: execucao, isLoading, error } = useExecucao(id);

  if (error instanceof ApiError && error.status === 404) return <NotFound />;

  const duracao =
    execucao?.finalizada_em &&
    (new Date(execucao.finalizada_em).getTime() - new Date(execucao.iniciada_em).getTime()) / 1000;

  return (
    <>
      <PageMeta title={`${t("detail.title")} | PostPilot`} description={execucao?.pedido ?? ""} />
      <PageBreadcrumb pageTitle={t("detail.title")} />

      {isLoading || !execucao ? (
        error ? (
          <p role="alert" className="text-sm text-error-600">
            {t("loadError")}
          </p>
        ) : (
          <div aria-hidden className="h-96 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        )
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {/* Pedido e resposta */}
            <section className={`${cardClass} p-5 sm:p-6`}>
              <h3 className="text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">
                {t("detail.request")}
              </h3>
              <p className="mt-2 text-base whitespace-pre-line text-gray-800 dark:text-white/90">
                {execucao.pedido}
              </p>

              {execucao.status === "completed" && execucao.resposta && (
                <>
                  <h3 className="mt-6 text-theme-xs font-medium text-gray-500 uppercase dark:text-gray-400">
                    {t("detail.answer")}
                  </h3>
                  <p className="mt-2 text-sm whitespace-pre-line text-gray-700 dark:text-gray-300">
                    {execucao.resposta}
                  </p>
                </>
              )}
              {execucao.status === "error" && (
                <p className="mt-6 text-sm text-error-600 dark:text-error-400">{t("failed")}</p>
              )}
              {execucao.status === "limit_reached" && (
                <p className="mt-6 text-sm text-warning-600 dark:text-orange-400">
                  {t("limitReached", { max: MAX_ITERACOES })}
                </p>
              )}
              {execucao.post_id && (
                <Link
                  to={`/posts/${execucao.post_id}`}
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
              <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">{t("detail.stepsHint")}</p>
              {execucao.passos.length === 0 && execucao.status !== "running" ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("detail.noSteps")}</p>
              ) : (
                <PassosLista
                  passos={execucao.passos}
                  executando={execucao.status === "running"}
                  detalhado
                />
              )}
            </section>
          </div>

          {/* Resumo */}
          <aside className={`${cardClass} h-fit p-5 sm:p-6`}>
            <dl className="space-y-4">
              <Info label={t("detail.status")}>
                <Badge color={STATUS_EXECUCAO_COR[execucao.status]} size="sm">
                  {tApp(`domain.runStatus.${execucao.status}`)}
                </Badge>
              </Info>
              <Info label={t("detail.mode")}>{tApp(`domain.agentMode.${execucao.modo}`)}</Info>
              <Info label={t("detail.started")}>
                {fmt.date(execucao.iniciada_em, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Info>
              {duracao ? (
                <Info label={t("detail.duration")}>
                  {fmt.number(Math.round(duracao * 10) / 10)} s
                </Info>
              ) : null}
              <Info label={t("detail.iterations")}>
                {t("detail.iterationsValue", { n: execucao.iteracoes, max: MAX_ITERACOES })}
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

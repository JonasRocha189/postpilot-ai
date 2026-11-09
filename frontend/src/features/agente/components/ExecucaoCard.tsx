import Badge from "@/components/ui/badge/Badge";
import { AiIcon, ArrowRightIcon } from "@/icons";
import { STATUS_EXECUCAO_COR } from "@/lib/dominio";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useExecucao } from "../api";
import { MAX_ITERATIONS } from "../types";
import PassosLista from "./PassosLista";

/** Uma troca na conversa: o pedido do usuário e o agente trabalhando/respondendo. */
export default function ExecucaoCard({ id }: { id: string }) {
  const { t } = useTranslation("app");
  const { data: execucao, isError } = useExecucao(id);

  if (isError) {
    return (
      <p role="alert" className="text-sm text-error-600">
        {t("agent.loadError")}
      </p>
    );
  }
  if (!execucao) return null;

  const executando = execucao.status === "running";

  return (
    <article className="space-y-4" aria-busy={executando}>
      {/* Pedido */}
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-ee-md bg-brand-500 px-4 py-3 text-sm whitespace-pre-line text-white">
          {execucao.request}
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
              {t(`domain.agentMode.${execucao.mode}`)}
            </Badge>
            <Badge color={STATUS_EXECUCAO_COR[execucao.status]} size="sm">
              {t(`domain.runStatus.${execucao.status}`)}
            </Badge>
          </div>

          <PassosLista steps={execucao.steps} executando={executando} />

          {execucao.status === "completed" && execucao.response && (
            <div className="mt-4 border-t border-gray-100 pt-4 text-sm whitespace-pre-line text-gray-800 dark:border-gray-800 dark:text-white/90">
              {execucao.response}
            </div>
          )}
          {execucao.status === "error" && (
            <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-error-600 dark:border-gray-800 dark:text-error-400">
              {t("agent.failed")}
            </p>
          )}
          {execucao.status === "limit_reached" && (
            <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-warning-600 dark:border-gray-800 dark:text-orange-400">
              {t("agent.limitReached", { max: MAX_ITERATIONS })}
            </p>
          )}

          {!executando && (
            <div className="mt-4 flex flex-wrap gap-2">
              {execucao.post_id && (
                <Link
                  to={`/posts/${execucao.post_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
                >
                  {t("agent.openDraft")}
                  <ArrowRightIcon className="size-4" />
                </Link>
              )}
              <Link
                to={`/agent/runs/${execucao.id}`}
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

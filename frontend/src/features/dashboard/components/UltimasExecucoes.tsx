import Badge from "@/components/ui/badge/Badge";
import { STATUS_EXECUCAO_COR } from "@/lib/dominio";
import { useFormat } from "@/lib/format";
import { useTranslation } from "react-i18next";
import type { ExecucaoResumo } from "../types";
import DashboardCard from "./DashboardCard";

export default function UltimasExecucoes({
  execucoes,
}: {
  execucoes: ExecucaoResumo[];
}) {
  const { t } = useTranslation("app");
  const fmt = useFormat();

  return (
    <DashboardCard
      title={t("dashboard.agentRuns.title")}
      subtitle={t("dashboard.agentRuns.subtitle")}
    >
      {execucoes.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("dashboard.agentRuns.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {execucoes.map((execucao) => (
            <li
              key={execucao.id}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="shrink-0 sm:w-20">
                <Badge color="primary" size="sm">
                  {t(`domain.agentMode.${execucao.mode}`)}
                </Badge>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-theme-sm text-gray-800 dark:text-white/90">
                  {execucao.request}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {fmt.relative(execucao.iniciadaEm)} ·{" "}
                  {t("dashboard.agentRuns.steps", { count: execucao.steps })}
                </p>
              </div>
              <div className="shrink-0">
                <Badge color={STATUS_EXECUCAO_COR[execucao.status]} size="sm">
                  {t(`domain.runStatus.${execucao.status}`)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

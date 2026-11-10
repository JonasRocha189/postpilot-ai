import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import { cardClass, primaryLinkClass } from "@/components/common/styles";
import Badge from "@/components/ui/badge/Badge";
import { useRuns } from "@/features/agent/api";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { AiIcon } from "@/icons";
import { RUN_STATUS_COLOR } from "@/lib/domain";
import { useFormat } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

const th =
  "px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
const td = "px-5 py-4 align-middle text-sm text-gray-600 dark:text-gray-400";

export default function Runs() {
  const { t } = useTranslation("app", { keyPrefix: "agent.runs" });
  const { t: tApp } = useTranslation("app");
  const fmt = useFormat();
  const { currentProject } = useCurrentProject();
  const { data: runs = [], isLoading, isError } = useRuns(currentProject?.id);

  const newLink = (
    <Link to="/agent" className={primaryLinkClass}>
      <AiIcon className="size-5" />
      {t("new")}
    </Link>
  );

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("subtitle")}
      />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { project: currentProject?.name })}
        action={newLink}
      />

      {isLoading ? (
        <div
          aria-hidden
          className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
        />
      ) : isError ? (
        <p role="alert" className="text-sm text-error-600">
          {tApp("agent.loadError")}
        </p>
      ) : runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-white/3">
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            {t("empty")}
          </p>
          {newLink}
        </div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className={th}>{t("columns.request")}</th>
                  <th className={`${th} hidden sm:table-cell`}>
                    {t("columns.mode")}
                  </th>
                  <th className={`${th} hidden md:table-cell`}>
                    {t("columns.steps")}
                  </th>
                  <th className={`${th} hidden md:table-cell`}>
                    {t("columns.started")}
                  </th>
                  <th className={th}>{t("columns.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {runs.map((e) => (
                  <tr key={e.id}>
                    <td className={td}>
                      <Link
                        to={`/agent/runs/${e.id}`}
                        className="line-clamp-2 font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                      >
                        {e.request}
                      </Link>
                      <p className="mt-1 text-theme-xs text-gray-500 md:hidden dark:text-gray-400">
                        {fmt.relative(e.started_at)}
                      </p>
                    </td>
                    <td className={`${td} hidden sm:table-cell`}>
                      <Badge color="primary" size="sm">
                        {tApp(`domain.agentMode.${e.mode}`)}
                      </Badge>
                    </td>
                    <td className={`${td} hidden tabular-nums md:table-cell`}>
                      {e.steps.length}
                    </td>
                    <td
                      className={`${td} hidden whitespace-nowrap md:table-cell`}
                    >
                      {fmt.relative(e.started_at)}
                    </td>
                    <td className={td}>
                      <Badge color={RUN_STATUS_COLOR[e.status]} size="sm">
                        {tApp(`domain.runStatus.${e.status}`)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

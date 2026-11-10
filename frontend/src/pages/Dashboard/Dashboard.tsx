import PageMeta from "@/components/common/PageMeta";
import { useDashboard } from "@/features/dashboard/api";
import DashboardCard from "@/features/dashboard/components/DashboardCard";
import PerformanceBySubject from "@/features/dashboard/components/PerformanceBySubject";
import EngagementByNetwork from "@/features/dashboard/components/EngagementByNetwork";
import BestDayTime from "@/features/dashboard/components/BestDayTime";
import UpcomingPosts from "@/features/dashboard/components/UpcomingPosts";
import SummaryCards from "@/features/dashboard/components/SummaryCards";
import LatestRuns from "@/features/dashboard/components/LatestRuns";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

/** Shown instead of the performance charts while no post has metrics. */
function NoMetrics() {
  const { t } = useTranslation("app", { keyPrefix: "dashboard.noMetrics" });
  return (
    <DashboardCard title={t("title")} subtitle={t("subtitle")}>
      <p className="text-sm text-gray-500 dark:text-gray-400">{t("text")}</p>
      <Link
        to="/metrics"
        className="mt-4 inline-flex rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
      >
        {t("action")}
      </Link>
    </DashboardCard>
  );
}

export default function Dashboard() {
  const { t } = useTranslation("app");
  const { currentProject } = useCurrentProject();
  const { data, isLoading, isError, refetch } = useDashboard(
    currentProject?.id,
  );
  const hasMetrics = (data?.performance.byNetwork.length ?? 0) > 0;

  return (
    <>
      <PageMeta
        title={`${t("dashboard.title")} | PostPilot`}
        description={t("dashboard.metaDescription")}
      />

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {t("dashboard.title")}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("dashboard.subtitle")}
        </p>
      </div>

      {isError ? (
        <div role="alert" className="text-sm text-error-600">
          {t("dashboard.loadError")}{" "}
          <button
            type="button"
            onClick={refetch}
            className="font-medium underline hover:no-underline"
          >
            {t("dashboard.retry")}
          </button>
        </div>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-12 gap-4 md:gap-6" aria-busy="true">
          <span className="sr-only">{t("common.loading")}</span>
          {["", "xl:col-span-7", "xl:col-span-5", ""].map((span, i) => (
            <div
              key={i}
              aria-hidden
              className={`col-span-12 h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800 ${span}`}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12">
            <SummaryCards
              postsByStatus={data.postsByStatus}
              byNetwork={data.performance.byNetwork}
            />
          </div>

          {hasMetrics ? (
            <>
              <div className="col-span-12 xl:col-span-7">
                <EngagementByNetwork byNetwork={data.performance.byNetwork} />
              </div>
              <div className="col-span-12 xl:col-span-5">
                <BestDayTime cells={data.performance.byDayTime} />
              </div>
              <div className="col-span-12 xl:col-span-7">
                <PerformanceBySubject bySubject={data.performance.bySubject} />
              </div>
            </>
          ) : (
            <div className="col-span-12 xl:col-span-7">
              <NoMetrics />
            </div>
          )}
          <div className="col-span-12 xl:col-span-5">
            <UpcomingPosts posts={data.upcomingPosts} />
          </div>

          <div className="col-span-12">
            <LatestRuns runs={data.latestRuns} />
          </div>
        </div>
      )}
    </>
  );
}

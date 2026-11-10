import Badge from "@/components/ui/badge/Badge";
import { NETWORK_LABEL, POST_STATUS_COLOR } from "@/lib/domain";
import { useFormat } from "@/lib/format";
import { useTranslation } from "react-i18next";
import type { UpcomingPost } from "../types";
import DashboardCard from "./DashboardCard";

export default function UpcomingPosts({ posts }: { posts: UpcomingPost[] }) {
  const { t } = useTranslation("app");
  const fmt = useFormat();

  return (
    <DashboardCard
      title={t("dashboard.upcoming.title")}
      subtitle={t("dashboard.upcoming.subtitle")}
    >
      {posts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("dashboard.upcoming.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {posts.map((post) => (
            <li key={post.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
              <div className="w-16 shrink-0 text-center">
                <p className="text-theme-xs text-gray-500 first-letter:uppercase dark:text-gray-400">
                  {fmt.date(post.expectedDate, { weekday: "short" })}
                </p>
                <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {/* The expected date has no time: day and month only */}
                  {fmt.date(post.expectedDate, {
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {post.title}
                </p>
                <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {post.subject} ·{" "}
                  {post.networks.map((r) => NETWORK_LABEL[r]).join(", ")}
                </p>
              </div>
              <div className="shrink-0">
                <Badge color={POST_STATUS_COLOR[post.status]} size="sm">
                  {t(`domain.postStatus.${post.status}`)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

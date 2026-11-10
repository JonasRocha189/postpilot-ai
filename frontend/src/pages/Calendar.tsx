import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import { useSubjects } from "@/features/subjects/api";
import PostDetailsModal from "@/features/calendar/components/PostDetailsModal";
import PostsCalendar from "@/features/calendar/components/PostsCalendar";
import { LEVEL_COLOR, STATUS_LEVEL } from "@/features/calendar/status";
import type { ScheduledPost } from "@/features/calendar/types";
import { usePosts } from "@/features/posts/api";
import { variationMatches } from "@/features/posts/types";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { POST_STATUS } from "@/lib/domain";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function Calendar() {
  const { t } = useTranslation("app");
  const { currentProject } = useCurrentProject();
  const [selected, setSelected] = useState<ScheduledPost | null>(null);

  // Fetches only the visible period's posts (the calendar tells us when the month changes)
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(
    null,
  );
  const posts = usePosts(period ? currentProject?.id : undefined, period ?? {});
  const subjects = useSubjects(currentProject?.id);

  const scheduled = useMemo<ScheduledPost[]>(() => {
    const names = new Map(subjects.data?.map((a) => [a.id, a.name]));
    // One event per variation with a date, inside the visible period
    return (posts.data ?? []).flatMap((p) =>
      p.variations
        .filter((v) => period && variationMatches(v, period))
        .map((v) => ({
          id: v.id,
          postId: p.id,
          title: p.title,
          subject: names.get(p.subject_id) ?? "—",
          network: v.network,
          format: v.format,
          status: v.status,
          expectedDate: v.expected_date!,
        })),
    );
  }, [posts.data, subjects.data, period]);

  return (
    <>
      <PageMeta
        title={`${t("calendar.title")} | PostPilot`}
        description={t("calendar.metaDescription")}
      />
      <PageHeader
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle")}
        action={
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {POST_STATUS.map((status) => (
              <li
                key={status}
                className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400"
              >
                <span
                  className={`size-2.5 rounded-full ${LEVEL_COLOR[STATUS_LEVEL[status]]}`}
                />
                {t(`domain.postStatus.${status}`)}
              </li>
            ))}
          </ul>
        }
      />

      {posts.isError ? (
        <p role="alert" className="text-sm text-error-600">
          {t("posts.loadError")}
        </p>
      ) : (
        // Stays mounted while loading: the calendar is what reports the period
        <div aria-busy={!period || posts.isFetching}>
          <PostsCalendar
            posts={scheduled}
            onSelect={setSelected}
            onRangeChange={setPeriod}
          />
        </div>
      )}
      <PostDetailsModal post={selected} onClose={() => setSelected(null)} />
    </>
  );
}

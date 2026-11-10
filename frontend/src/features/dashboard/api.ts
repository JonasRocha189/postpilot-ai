import { useRuns } from "@/features/agent/api";
import { useSubjects } from "@/features/subjects/api";
import { usePosts } from "@/features/posts/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  countByStatus,
  groupPerformance,
  latestRuns,
  localToday,
  upcomingPosts,
} from "./aggregate";
import { reportsService } from "./service";
import type { DashboardData } from "./types";

export const reportsKeys = {
  all: ["reports"] as const,
  performance: (projectId: string) =>
    ["reports", "performance", projectId] as const,
};

export function usePerformanceReport(projectId: string | undefined) {
  return useQuery({
    queryKey: reportsKeys.performance(projectId ?? ""),
    queryFn: () => reportsService.performance(projectId!),
    enabled: Boolean(projectId),
  });
}

/** Everything the dashboard shows, from the posts, runs and performance APIs. */
export function useDashboard(projectId: string | undefined) {
  const posts = usePosts(projectId);
  const subjects = useSubjects(projectId);
  const runs = useRuns(projectId);
  const report = usePerformanceReport(projectId);
  const queries = [posts, subjects, runs, report];

  const data = useMemo((): DashboardData | undefined => {
    if (!posts.data || !subjects.data || !runs.data || !report.data) {
      return undefined;
    }
    const names = new Map(subjects.data.map((s) => [s.id, s.name]));
    return {
      postsByStatus: countByStatus(posts.data),
      upcomingPosts: upcomingPosts(posts.data, names, localToday()),
      latestRuns: latestRuns(runs.data),
      performance: groupPerformance(report.data.posts),
    };
  }, [posts.data, subjects.data, runs.data, report.data]);

  return {
    data,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    refetch: () => queries.forEach((q) => void q.refetch()),
  };
}

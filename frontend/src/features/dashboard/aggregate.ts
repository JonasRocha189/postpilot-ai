import type { AgentRun } from "@/features/agent/types";
import type { Post } from "@/features/posts/types";
import { NETWORKS } from "@/features/posts/networks";
import type { Network, PostStatus } from "@/lib/domain";
import type {
  DayTimeCell,
  DashboardData,
  RunSummary,
  TimeBand,
  Interactions,
  MetricsGroup,
  PostPerformance,
  UpcomingPost,
} from "./types";

// Turns the API responses into what each widget shows. Pure functions: tested
// without React or network (aggregate.test.ts).

const UPCOMING_LIMIT = 5;
const RUNS_LIMIT = 5;

/** The band of a local hour (same as the agent's time_of_day) */
export function timeBand(hour: number): TimeBand {
  if (hour < 6) return "madrugada";
  if (hour < 12) return "manha";
  if (hour < 18) return "tarde";
  return "noite";
}

type Numbers = Interactions & { posts: number; impressions: number };

const zero = (): Numbers => ({
  posts: 0,
  impressions: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  clicks: 0,
});

function add(total: Numbers, post: PostPerformance): Numbers {
  return {
    posts: total.posts + 1,
    impressions: total.impressions + post.impressions,
    likes: total.likes + post.likes,
    comments: total.comments + post.comments,
    shares: total.shares + post.shares,
    clicks: total.clicks + post.clicks,
  };
}

function groupBy<K>(
  posts: PostPerformance[],
  key: (post: PostPerformance) => K,
): Map<K, Numbers> {
  const groups = new Map<K, Numbers>();
  for (const post of posts) {
    const k = key(post);
    groups.set(k, add(groups.get(k) ?? zero(), post));
  }
  return groups;
}

/** Totals per network (in the app's network order), subject and day × band. */
export function groupPerformance(
  posts: PostPerformance[],
): DashboardData["performance"] {
  const networkTotals = groupBy(posts, (p) => p.network);
  const byNetwork = NETWORKS.filter((network) =>
    networkTotals.has(network),
  ).map((network) => ({
    group: network,
    ...networkTotals.get(network)!,
  }));

  const bySubject: MetricsGroup[] = [...groupBy(posts, (p) => p.subject)].map(
    ([group, numbers]) => ({ group, ...numbers }),
  );

  // The API uses ISO weekdays (7 = Sunday); the chart uses 0 = Sunday
  const byCell = groupBy(posts, (p) => `${p.weekday % 7}|${timeBand(p.hour)}`);
  const byDayTime: DayTimeCell[] = [...byCell].map(([key, numbers]) => {
    const [day, band] = key.split("|");
    return { day: Number(day), band: band as TimeBand, ...numbers };
  });

  return { byNetwork, bySubject, byDayTime };
}

/** How many variations are in each status (a post counts once per network). */
export function countByStatus(posts: Post[]): Record<PostStatus, number> {
  const counts: Record<PostStatus, number> = {
    draft: 0,
    review: 0,
    approved: 0,
    published: 0,
  };
  for (const post of posts) {
    for (const variation of post.variations) counts[variation.status] += 1;
  }
  return counts;
}

/**
 * Posts with a variation expected from today on and not published yet, by the
 * nearest date. `today` is YYYY-MM-DD in the user's time zone.
 */
export function upcomingPosts(
  posts: Post[],
  subjectNames: Map<string, string>,
  today: string,
): UpcomingPost[] {
  const upcoming: UpcomingPost[] = [];
  for (const post of posts) {
    const pending = post.variations.filter(
      (v) =>
        v.expected_date !== null &&
        v.expected_date >= today &&
        v.status !== "published",
    );
    if (pending.length === 0) continue;
    const first = pending.reduce((a, b) =>
      a.expected_date! <= b.expected_date! ? a : b,
    );
    upcoming.push({
      id: post.id,
      title: post.title,
      subject: subjectNames.get(post.subject_id) ?? "",
      networks: pending.map((v) => v.network as Network),
      status: first.status,
      // Local midnight: a bare YYYY-MM-DD would be read as UTC (the day before in Brazil)
      expectedDate: `${first.expected_date}T00:00:00`,
    });
  }
  return upcoming
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
    .slice(0, UPCOMING_LIMIT);
}

/** The most recent runs (the API already sends them newest first). */
export function latestRuns(runs: AgentRun[]): RunSummary[] {
  return runs.slice(0, RUNS_LIMIT).map((run) => ({
    id: run.id,
    mode: run.mode,
    request: run.request,
    status: run.status,
    steps: run.steps.length,
    startedAt: run.started_at,
  }));
}

/** Today as YYYY-MM-DD in the user's time zone */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

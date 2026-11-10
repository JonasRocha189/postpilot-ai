import type { AgentMode, Network, RunStatus, PostStatus } from "@/lib/domain";

// What the dashboard widgets show, built from GET /posts, GET /agent/runs and
// GET /reports/performance (see aggregate.ts).

export type Interactions = {
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
};

export type MetricsGroup = Interactions & {
  group: string;
  posts: number;
  impressions: number;
};

/** Same bands as the agent's analyze_performance (madrugada = 0h–6h) */
export type TimeBand = "madrugada" | "manha" | "tarde" | "noite";

/** day: 0 = Sunday ... 6 = Saturday */
export type DayTimeCell = Interactions & {
  day: number;
  band: TimeBand;
  posts: number;
  impressions: number;
};

export type UpcomingPost = {
  id: string;
  title: string;
  subject: string;
  networks: Network[];
  status: PostStatus;
  expectedDate: string; // ISO
};

export type RunSummary = {
  id: string;
  mode: AgentMode;
  request: string;
  status: RunStatus;
  steps: number;
  startedAt: string; // ISO
};

export type DashboardData = {
  postsByStatus: Record<PostStatus, number>;
  upcomingPosts: UpcomingPost[];
  latestRuns: RunSummary[];
  performance: {
    byNetwork: (MetricsGroup & { group: Network })[];
    bySubject: MetricsGroup[];
    byDayTime: DayTimeCell[];
  };
};

// --- GET /reports/performance (mirrors backend/schemas/reports.py) ----------

/** The latest numbers of one published variation */
export type PostPerformance = {
  variation_id: string;
  post_id: string;
  title: string;
  subject: string;
  network: Network;
  published_at: string;
  /** In the report's time zone: ISO weekday (1 = Monday ... 7 = Sunday) */
  weekday: number;
  /** In the report's time zone: 0-23 */
  hour: number;
  has_image: boolean;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
};

export type PerformanceReport = {
  timezone: string;
  /** Groups with fewer posts support no conclusion */
  min_sample: number;
  posts: PostPerformance[];
};

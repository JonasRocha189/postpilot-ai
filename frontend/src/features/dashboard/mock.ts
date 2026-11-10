// FAKE GET /reports/performance (see lib/api/mockDb.ts): built from the mock
// posts and metrics, like the backend builds it from the database.
import { latencia, mockDb } from "@/lib/api/mockDb";
import type { ReportsService } from "./service";
import type { PerformanceReport, PostPerformance } from "./types";

const TIMEZONE = "America/Sao_Paulo";
const MIN_SAMPLE = 5;

/** ISO weekday and hour in São Paulo, as Postgres computes them */
function localTime(iso: string): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekday =
    weekdays.indexOf(parts.find((p) => p.type === "weekday")!.value) + 1;
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  return { weekday, hour };
}

export const reportsMock: ReportsService = {
  async performance(projectId) {
    await latencia();
    const subjects = new Map(
      mockDb.assuntos
        .todos()
        .filter((s) => s.project_id === projectId)
        .map((s) => [s.id, s.name]),
    );
    const metrics = mockDb.metricas.todos();
    const posts: PostPerformance[] = [];
    for (const post of mockDb.posts.todos()) {
      const subject = subjects.get(post.subject_id);
      if (subject === undefined) continue;
      for (const variation of post.variations) {
        // The latest collection holds the current totals
        const latest = metrics
          .filter((m) => m.variacao_id === variation.id)
          .sort((a, b) => b.coletado_em.localeCompare(a.coletado_em))[0];
        if (!latest) continue;
        posts.push({
          variation_id: variation.id,
          post_id: post.id,
          title: post.title,
          subject,
          network: variation.network,
          published_at: latest.publicado_em,
          ...localTime(latest.publicado_em),
          has_image: variation.image_ids.length > 0,
          impressions: latest.impressoes,
          likes: latest.curtidas,
          comments: latest.comentarios,
          shares: latest.compartilhamentos,
          clicks: latest.cliques,
        });
      }
    }
    const report: PerformanceReport = {
      timezone: TIMEZONE,
      min_sample: MIN_SAMPLE,
      posts,
    };
    return report;
  },
};

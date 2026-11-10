// FAKE metrics API (see lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { latency, mockDb, mockVariation } from "@/lib/api/mockDb";
import type { MetricsService } from "./service";

export const metricsMock: MetricsService = {
  async importMetrics(input) {
    await latency();
    if (input.rows.length === 0) throw new ApiError(422, "No rows to import");
    // Like the backend: every row must be a published variation of the network
    const checked = input.rows.map((row) => {
      const { variation } = mockVariation(row.variation_id);
      if (
        variation.network !== input.network ||
        variation.status !== "published"
      ) {
        throw new ApiError(422, "Variation is not published on this network");
      }
      return row;
    });
    for (const row of checked) {
      mockDb.metrics.insert({
        id: crypto.randomUUID(),
        variation_id: row.variation_id,
        published_at: row.published_at,
        impressions: row.impressions,
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        clicks: row.clicks,
        collected_at: input.collected_at,
      });
    }
    return { created: checked.length };
  },
};

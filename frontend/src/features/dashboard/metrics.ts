import type { Interactions } from "./types";

/** Minimum posts per group for a performance conclusion (the agent's rule). */
export const MIN_SAMPLE = 5;

export function totalInteractions(m: Interactions): number {
  return m.likes + m.comments + m.shares + m.clicks;
}

/** Interactions / impressions, between 0 and 1. Zero when there are no impressions. */
export function engagementRate(
  m: Interactions & { impressions: number },
): number {
  return m.impressions > 0 ? totalInteractions(m) / m.impressions : 0;
}

export function enoughSample(posts: number): boolean {
  return posts >= MIN_SAMPLE;
}

/** Adds up interactions and impressions of several groups. */
export function add<
  T extends Interactions & { impressions: number; posts: number },
>(groups: T[]): Interactions & { impressions: number; posts: number } {
  return groups.reduce(
    (acc, g) => ({
      posts: acc.posts + g.posts,
      impressions: acc.impressions + g.impressions,
      likes: acc.likes + g.likes,
      comments: acc.comments + g.comments,
      shares: acc.shares + g.shares,
      clicks: acc.clicks + g.clicks,
    }),
    {
      posts: 0,
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
    },
  );
}

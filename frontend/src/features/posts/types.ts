import type { PostFormat, Network, PostStatus } from "@/lib/domain";

// Mirrors the backend schema (see _docs/api.md).

/**
 * The post adapted to one network (detail of the master-detail screen): its
 * own text, format, images, status and date. At most one per network.
 */
export type PostVariation = {
  /** Kept per network when the post is saved again (metrics hang on it) */
  id: string;
  network: Network;
  format: PostFormat;
  content: string | null;
  status: PostStatus;
  expected_date: string | null; // YYYY-MM-DD
  /** Images from the project library, in carousel order */
  image_ids: string[];
};

/** The post (master): the idea, with one variation per network. */
export type Post = {
  id: string;
  subject_id: string;
  title: string;
  /** Ordered by network: LinkedIn, Instagram, X */
  variations: PostVariation[];
  created_at: string;
  updated_at: string;
};

/** A variation in the request body (the backend matches it by network). */
export type PostVariationInput = Omit<PostVariation, "id">;

/** Body of POST /posts and PUT /posts/{id} (PUT replaces all variations) */
export type PostInput = {
  subject_id: string;
  title: string;
  variations: PostVariationInput[];
};

/**
 * Filters of GET /posts (besides the project). A post is returned when at
 * least one variation matches status, network and period together.
 */
export type PostFilters = {
  status?: PostStatus;
  network?: Network;
  subject_id?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
};

/** Does the variation match the list filters? (same rule as the backend) */
export function variationMatches(
  variation: Pick<PostVariation, "status" | "network" | "expected_date">,
  filters: Omit<PostFilters, "subject_id">,
): boolean {
  const date = variation.expected_date;
  return (
    (!filters.status || variation.status === filters.status) &&
    (!filters.network || variation.network === filters.network) &&
    (!filters.from || (date !== null && date >= filters.from)) &&
    (!filters.to || (date !== null && date <= filters.to))
  );
}

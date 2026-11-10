import type { PostFormat, Network, PostStatus } from "@/lib/domain";

// A scheduled variation (one network of a post), as the calendar shows it
export type ScheduledPost = {
  /** Variation id (each network is its own calendar event) */
  id: string;
  postId: string;
  title: string;
  subject: string;
  network: Network;
  format: PostFormat;
  status: PostStatus;
  expectedDate: string; // AAAA-MM-DD
};

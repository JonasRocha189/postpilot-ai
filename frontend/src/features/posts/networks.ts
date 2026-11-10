import type { PostFormat, Network, PostStatus } from "@/lib/domain";

export const NETWORKS: readonly Network[] = ["linkedin", "instagram", "x"];

/** Character limit of each network (text + hashtags). */
export const CHAR_LIMIT_BY_NETWORK: Record<Network, number> = {
  linkedin: 3000,
  instagram: 2200,
  x: 280,
};

// Rules per network. The backend checks the same ones (schemas/posts.py).

/** Formats accepted per network, in the order the form shows them. */
export const FORMATS_BY_NETWORK: Record<Network, readonly PostFormat[]> = {
  instagram: ["single", "carousel"],
  linkedin: ["text", "single", "carousel"],
  x: ["text", "single", "carousel"],
};

/** Maximum images per post (Instagram and LinkedIn carousels, up to 4 on X). */
export const MAX_IMAGES: Record<Network, number> = {
  instagram: 20,
  linkedin: 20,
  x: 4,
};

/** Characters shown before "see more" (null = the whole post). */
export const VISIBLE_BEFORE_MORE: Record<Network, number | null> = {
  instagram: 125,
  linkedin: 210,
  x: null,
};

/** How many images the format accepts on the network. */
export function maxImagesFor(network: Network, format: PostFormat): number {
  if (format === "text") return 0;
  if (format === "single") return 1;
  return MAX_IMAGES[network];
}

/** Statuses in which the post must be complete (drafts may lack an image). */
const READY_STATUSES: readonly PostStatus[] = ["approved", "published"];

export type RuleError = {
  field: "format" | "content" | "image_ids";
  /** Translation key ("app" namespace) */
  message: string;
  values?: Record<string, string | number>;
};

/** The first network rule the post breaks, or null. */
export function postRuleError(post: {
  network: Network;
  format: PostFormat;
  images: number;
  text: string;
  status: PostStatus;
}): RuleError | null {
  const { network, format, images, text, status } = post;
  if (!FORMATS_BY_NETWORK[network].includes(format)) {
    return {
      field: "format",
      message: "posts.form.errors.formatNotAvailable",
    };
  }
  if (countCharacters(text, []) > CHAR_LIMIT_BY_NETWORK[network]) {
    return {
      field: "content",
      message: "posts.form.errors.tooLongForNetwork",
      values: { limit: CHAR_LIMIT_BY_NETWORK[network] },
    };
  }
  const max = maxImagesFor(network, format);
  if (images > max) {
    return {
      field: "image_ids",
      message: "posts.form.errors.tooManyImages",
      values: { max: max },
    };
  }
  if (READY_STATUSES.includes(status)) {
    if (format === "single" && images !== 1) {
      return {
        field: "image_ids",
        message: "posts.form.errors.needsOneImage",
      };
    }
    if (format === "carousel" && images < 2) {
      return {
        field: "image_ids",
        message: "posts.form.errors.needsTwoImages",
      };
    }
  }
  return null;
}

/** "#nuvem, marketing  #Nuvem" → ["nuvem", "marketing"] (no repeats, no #). */
export function parseHashtags(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of input.split(/[\s,]+/)) {
    const tag = part.replace(/^#+/, "").trim();
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      result.push(tag);
    }
  }
  return result;
}

export function formatHashtags(hashtags: string[]): string {
  return hashtags.map((h) => `#${h}`).join(" ");
}

/** Text as it will be published: text, a blank line and the hashtags. */
export function finalText(text: string, hashtags: string[]): string {
  const tags = formatHashtags(hashtags);
  return tags ? `${text.trim()}\n\n${tags}` : text.trim();
}

export function countCharacters(text: string, hashtags: string[]): number {
  // Array.from counts emojis and combined accents as one character
  return Array.from(finalText(text, hashtags)).length;
}

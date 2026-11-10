// FAKE posts API (see lib/api/mockDb.ts)
import { ApiError } from "@/lib/api/http";
import { nowIso, latency, mockDb } from "@/lib/api/mockDb";
import { postRuleError } from "./networks";
import type { PostsService } from "./service";
import type { Post, PostInput, PostVariation } from "./types";
import { variationMatches } from "./types";

const NAME = "Post";

function checkSubject(subjectId: string) {
  if (!mockDb.subjects.todos().some((a) => a.id === subjectId)) {
    throw new ApiError(404, "Subject not found");
  }
}

/** Like the backend: at least one variation, one per network, network rules,
 * and images from the subject's project library (no repeats). */
function checkVariations(input: PostInput) {
  const { variations } = input;
  if (variations.length === 0) {
    throw new ApiError(422, "A post needs at least one variation");
  }
  if (new Set(variations.map((v) => v.network)).size !== variations.length) {
    throw new ApiError(422, "Only one variation per network");
  }
  const subject = mockDb.subjects.find(input.subject_id, "Assunto");
  const library = new Set(
    mockDb.images
      .todos()
      .filter((i) => i.project_id === subject.project_id)
      .map((i) => i.id),
  );
  for (const v of variations) {
    if (
      new Set(v.image_ids).size !== v.image_ids.length ||
      v.image_ids.some((id) => !library.has(id))
    ) {
      throw new ApiError(422, "Image is not in this project's library");
    }
    const error = postRuleError({
      network: v.network,
      format: v.format,
      images: v.image_ids.length,
      text: v.content ?? "",
      status: v.status,
    });
    if (error) throw new ApiError(422, error.message);
  }
}

/** Keeps the id of each network's variation (metrics hang on it). */
function withIds(input: PostInput, current?: Post): PostVariation[] {
  return input.variations.map((v) => ({
    ...v,
    id:
      current?.variations.find((old) => old.network === v.network)?.id ??
      crypto.randomUUID(),
  }));
}

export const postsMock: PostsService = {
  async list(projectId, filters = {}) {
    await latency();
    const subjectsOfProject = new Set(
      mockDb.subjects
        .todos()
        .filter((a) => a.project_id === projectId)
        .map((a) => a.id),
    );
    return mockDb.posts
      .todos()
      .filter((p) => subjectsOfProject.has(p.subject_id))
      .filter((p) => !filters.subject_id || p.subject_id === filters.subject_id)
      .filter((p) => p.variations.some((v) => variationMatches(v, filters)))
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async get(id) {
    await latency();
    return mockDb.posts.find(id, NAME);
  },

  async create(input) {
    await latency();
    checkSubject(input.subject_id);
    checkVariations(input);
    const now = nowIso();
    return mockDb.posts.insert({
      id: crypto.randomUUID(),
      subject_id: input.subject_id,
      title: input.title,
      variations: withIds(input),
      created_at: now,
      updated_at: now,
    });
  },

  async update(id, input) {
    await latency();
    const current = mockDb.posts.find(id, NAME);
    checkSubject(input.subject_id);
    checkVariations(input);
    return mockDb.posts.replace({
      ...current,
      subject_id: input.subject_id,
      title: input.title,
      variations: withIds(input, current),
      updated_at: nowIso(),
    });
  },

  async remove(id) {
    await latency();
    mockDb.posts.find(id, NAME);
    mockDb.posts.remove(id);
  },
};

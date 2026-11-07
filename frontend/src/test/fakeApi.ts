// Fake backend for the integration tests: MSW answers the same routes as the
// FastAPI backend (/api/v1/...) from in-memory data, with the same rules
// (project scoping, 404, 409, 422) and the S3 presigned upload.
import type { Assunto } from "@/features/assuntos/types";
import type { Idea, IdeaInput } from "@/features/ideas/types";
import type { Imagem } from "@/features/imagens/types";
import type {
  MetricsImportInput,
  MetricsImportRow,
} from "@/features/metricas/types";
import { erroRegraPost } from "@/features/posts/redes";
import {
  variationMatches,
  type Post,
  type PostInput,
  type PostVariation,
} from "@/features/posts/types";
import type { Rede, StatusPost } from "@/lib/dominio";
import type { Projeto } from "@/features/projetos/types";
import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";

export const API = "http://api.test/api/v1";
export const S3 = "http://s3.test/postpilot-dev";

const s3Cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT",
  "Access-Control-Allow-Headers": "*",
};

type Db = {
  projects: Projeto[];
  subjects: Assunto[];
  posts: Post[];
  images: (Imagem & { key: string })[];
  uploads: Set<string>;
  ideas: Idea[];
  /** Rows saved by POST /metrics/import, with the collection date */
  metrics: (MetricsImportRow & { collected_at: string })[];
};

export type LoggedRequest = { method: string; url: URL; body: unknown };

const now = "2026-11-03T12:00:00Z";
let seq = 0;
const newId = (prefix: string) => `${prefix}-${++seq}`;

function emptyDb(): Db {
  return {
    projects: [],
    subjects: [],
    posts: [],
    images: [],
    uploads: new Set(),
    ideas: [],
    metrics: [],
  };
}

let db = emptyDb();
const log: LoggedRequest[] = [];

const notFound = (what: string) =>
  HttpResponse.json({ detail: `${what} not found` }, { status: 404 });
const conflict = (detail: string) =>
  HttpResponse.json({ detail }, { status: 409 });
const invalid = (detail: string) =>
  HttpResponse.json({ detail }, { status: 422 });
const noContent = () => new HttpResponse(null, { status: 204 });

/** The API never returns the S3 key, only the presigned URL. */
function semChave<T extends { key: string }>(image: T): Omit<T, "key"> {
  const copia: Partial<T> = { ...image };
  delete copia.key;
  return copia as Omit<T, "key">;
}

async function body<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

/** Records every API call so tests can assert URLs, query strings and bodies. */
async function record(request: Request) {
  let parsed: unknown = null;
  if (request.method !== "GET" && request.method !== "DELETE") {
    parsed = await request
      .clone()
      .json()
      .catch(() => null);
  }
  log.push({ method: request.method, url: new URL(request.url), body: parsed });
}

const projectOfSubject = (subjectId: string) =>
  db.subjects.find((s) => s.id === subjectId)?.project_id;

const handlers = [
  http.all(`${API}/*`, async ({ request }) => {
    await record(request);
    // Falls through to the specific handler
  }),

  // --- projects ------------------------------------------------------------
  http.get(`${API}/projects`, () =>
    HttpResponse.json(
      [...db.projects].sort((a, b) => a.name.localeCompare(b.name)),
    ),
  ),
  http.post(`${API}/projects`, async ({ request }) => {
    const input = await body<Partial<Projeto>>(request);
    const project: Projeto = {
      id: newId("proj"),
      name: input.name ?? "",
      description: input.description ?? null,
      target_audience: input.target_audience ?? null,
      voice_tone: input.voice_tone ?? null,
      created_at: now,
      updated_at: now,
    };
    db.projects.push(project);
    return HttpResponse.json(project, { status: 201 });
  }),
  http.get(`${API}/projects/:id`, ({ params }) => {
    const project = db.projects.find((p) => p.id === params.id);
    return project ? HttpResponse.json(project) : notFound("Project");
  }),
  http.put(`${API}/projects/:id`, async ({ params, request }) => {
    const project = db.projects.find((p) => p.id === params.id);
    if (!project) return notFound("Project");
    Object.assign(project, await body<Partial<Projeto>>(request));
    return HttpResponse.json(project);
  }),
  http.delete(`${API}/projects/:id`, ({ params }) => {
    if (!db.projects.some((p) => p.id === params.id))
      return notFound("Project");
    if (db.subjects.some((s) => s.project_id === params.id))
      return conflict("Project has subjects");
    if (db.images.some((i) => i.project_id === params.id))
      return conflict("Project has images");
    db.projects = db.projects.filter((p) => p.id !== params.id);
    return noContent();
  }),

  // --- subjects ------------------------------------------------------------
  http.get(`${API}/subjects`, ({ request }) => {
    const projectId = new URL(request.url).searchParams.get("project_id");
    if (!db.projects.some((p) => p.id === projectId))
      return notFound("Project");
    return HttpResponse.json(
      db.subjects.filter((s) => s.project_id === projectId),
    );
  }),
  http.post(`${API}/subjects`, async ({ request }) => {
    const input = await body<Partial<Assunto>>(request);
    if (!db.projects.some((p) => p.id === input.project_id))
      return notFound("Project");
    const subject: Assunto = {
      id: newId("subj"),
      project_id: input.project_id!,
      name: input.name ?? "",
      description: input.description ?? null,
      target_audience: input.target_audience ?? null,
      voice_tone: input.voice_tone ?? null,
      created_at: now,
      updated_at: now,
    };
    db.subjects.push(subject);
    return HttpResponse.json(subject, { status: 201 });
  }),
  http.get(`${API}/subjects/:id`, ({ params }) => {
    const subject = db.subjects.find((s) => s.id === params.id);
    return subject ? HttpResponse.json(subject) : notFound("Subject");
  }),
  http.delete(`${API}/subjects/:id`, ({ params }) => {
    if (db.posts.some((p) => p.subject_id === params.id))
      return conflict("Subject has posts");
    db.subjects = db.subjects.filter((s) => s.id !== params.id);
    return noContent();
  }),

  // --- posts ---------------------------------------------------------------
  http.get(`${API}/posts`, ({ request }) => {
    const q = new URL(request.url).searchParams;
    const projectId = q.get("project_id");
    if (!db.projects.some((p) => p.id === projectId))
      return notFound("Project");
    // A post matches when one of its variations matches all the filters
    const filters = {
      status: (q.get("status") ?? undefined) as StatusPost | undefined,
      network: (q.get("network") ?? undefined) as Rede | undefined,
      from: q.get("from") ?? undefined,
      to: q.get("to") ?? undefined,
    };
    const posts = db.posts
      .filter((p) => projectOfSubject(p.subject_id) === projectId)
      .filter(
        (p) => !q.get("subject_id") || p.subject_id === q.get("subject_id"),
      )
      .filter((p) => p.variations.some((v) => variationMatches(v, filters)))
      .sort((a, b) => a.title.localeCompare(b.title));
    return HttpResponse.json(posts);
  }),
  http.post(`${API}/posts`, async ({ request }) => {
    const input = await body<PostInput>(request);
    const projectId = projectOfSubject(input.subject_id ?? "");
    if (!projectId) return notFound("Subject");
    const error = variationsError(input, projectId);
    if (error) return invalid(error);
    const post: Post = {
      id: newId("post"),
      subject_id: input.subject_id,
      title: input.title,
      variations: withIds(input),
      created_at: now,
      updated_at: now,
    };
    db.posts.push(post);
    return HttpResponse.json(post, { status: 201 });
  }),
  http.get(`${API}/posts/:id`, ({ params }) => {
    const post = db.posts.find((p) => p.id === params.id);
    return post ? HttpResponse.json(post) : notFound("Post");
  }),
  http.put(`${API}/posts/:id`, async ({ params, request }) => {
    const post = db.posts.find((p) => p.id === params.id);
    if (!post) return notFound("Post");
    const input = await body<PostInput>(request);
    const projectId = projectOfSubject(input.subject_id ?? "");
    if (!projectId) return notFound("Subject");
    const error = variationsError(input, projectId);
    if (error) return invalid(error);
    Object.assign(post, {
      subject_id: input.subject_id,
      title: input.title,
      variations: withIds(input, post),
    });
    return HttpResponse.json(post);
  }),
  http.delete(`${API}/posts/:id`, ({ params }) => {
    db.posts = db.posts.filter((p) => p.id !== params.id);
    return noContent();
  }),

  // --- ideas ----------------------------------------------------------------
  http.get(`${API}/ideas`, ({ request }) => {
    const projectId = new URL(request.url).searchParams.get("project_id");
    if (!db.projects.some((p) => p.id === projectId))
      return notFound("Project");
    return HttpResponse.json(
      db.ideas
        .filter((i) => i.project_id === projectId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }),
  http.get(`${API}/ideas/:id`, ({ params }) => {
    const idea = db.ideas.find((i) => i.id === params.id);
    return idea ? HttpResponse.json(idea) : notFound("Idea");
  }),
  http.post(`${API}/ideas`, async ({ request }) => {
    const input = await body<IdeaInput & { project_id: string }>(request);
    if (!db.projects.some((p) => p.id === input.project_id))
      return notFound("Project");
    if (!input.title?.trim()) return invalid("Title is required");
    if (
      input.subject_id &&
      projectOfSubject(input.subject_id) !== input.project_id
    )
      return invalid("Subject is not in this project");
    const idea: Idea = {
      id: newId("idea"),
      project_id: input.project_id,
      title: input.title,
      notes: input.notes ?? null,
      subject_id: input.subject_id ?? null,
      networks: input.networks ?? [],
      source: "manual",
      post_id: null,
      created_at: `${now}#${seq}`,
      updated_at: now,
    };
    db.ideas.push(idea);
    return HttpResponse.json(idea, { status: 201 });
  }),
  http.put(`${API}/ideas/:id`, async ({ params, request }) => {
    const idea = db.ideas.find((i) => i.id === params.id);
    if (!idea) return notFound("Idea");
    const input = await body<IdeaInput>(request);
    if (!input.title?.trim()) return invalid("Title is required");
    Object.assign(idea, {
      title: input.title,
      notes: input.notes ?? null,
      subject_id: input.subject_id ?? null,
      networks: input.networks ?? [],
      post_id: input.post_id === undefined ? idea.post_id : input.post_id,
    });
    return HttpResponse.json(idea);
  }),
  http.delete(`${API}/ideas/:id`, ({ params }) => {
    db.ideas = db.ideas.filter((i) => i.id !== params.id);
    return noContent();
  }),

  // --- metrics import --------------------------------------------------------
  http.post(`${API}/metrics/import`, async ({ request }) => {
    const input = await body<MetricsImportInput>(request);
    if (!input.rows?.length) return invalid("No rows to import");
    // All or nothing: every row must be a published variation of the network
    for (const row of input.rows) {
      const variation = db.posts
        .flatMap((p) => p.variations)
        .find((v) => v.id === row.variation_id);
      if (!variation) return notFound("Variation");
      if (
        variation.network !== input.network ||
        variation.status !== "published"
      )
        return invalid("Variation is not published on this network");
    }
    db.metrics.push(
      ...input.rows.map((row) => ({
        ...row,
        collected_at: input.collected_at,
      })),
    );
    return HttpResponse.json({ created: input.rows.length }, { status: 201 });
  }),

  // --- images (library) + S3 ------------------------------------------------
  http.get(`${API}/images`, ({ request }) => {
    const projectId = new URL(request.url).searchParams.get("project_id");
    if (!db.projects.some((p) => p.id === projectId))
      return notFound("Project");
    return HttpResponse.json(
      db.images.filter((i) => i.project_id === projectId).map(semChave),
    );
  }),
  http.post(`${API}/images/upload-url`, async ({ request }) => {
    const input = await body<{
      project_id: string;
      content_type: string;
      size_bytes: number;
    }>(request);
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(input.content_type)
    ) {
      return invalid("Unsupported image type");
    }
    const key = `users/test/projects/${input.project_id}/images/${newId("file")}.png`;
    return HttpResponse.json({
      key,
      upload_url: `${S3}/${key}?X-Amz-Signature=test`,
    });
  }),
  // Like the real bucket, S3 answers with CORS headers (the browser checks them)
  http.options(
    `${S3}/*`,
    () => new HttpResponse(null, { status: 200, headers: s3Cors }),
  ),
  http.put(`${S3}/*`, ({ request }) => {
    const key = new URL(request.url).pathname.replace("/postpilot-dev/", "");
    db.uploads.add(key);
    return new HttpResponse(null, { status: 200, headers: s3Cors });
  }),
  http.post(`${API}/images`, async ({ request }) => {
    const input = await body<{
      project_id: string;
      key: string;
      content_type: string;
      description: string | null;
    }>(request);
    if (!db.uploads.has(input.key)) return invalid("Image was not uploaded");
    const image = {
      id: newId("img"),
      project_id: input.project_id,
      key: input.key,
      content_type: input.content_type,
      description: input.description,
      url: `${S3}/${input.key}?read`,
      created_at: now,
      updated_at: now,
    };
    db.images.unshift(image);
    return HttpResponse.json(semChave(image), { status: 201 });
  }),
  http.delete(`${API}/images/:id`, ({ params }) => {
    const used = db.posts.some((p) =>
      p.variations.some((v) => v.image_ids.includes(params.id as string)),
    );
    if (used) return conflict("Image is used by posts");
    db.images = db.images.filter((i) => i.id !== params.id);
    return noContent();
  }),
];

/** Same checks as the backend for the variations of a post body. */
function variationsError(input: PostInput, projectId: string): string | null {
  const variations = input.variations ?? [];
  if (variations.length === 0) return "A post needs at least one variation";
  if (new Set(variations.map((v) => v.network)).size !== variations.length)
    return "Only one variation per network";
  for (const v of variations) {
    if (
      v.image_ids.some(
        (id) => db.images.find((i) => i.id === id)?.project_id !== projectId,
      )
    )
      return "Image is not in this project's library";
    // Same network rules as the backend (format, text length, images)
    const rule = erroRegraPost({
      network: v.network,
      format: v.format,
      imagens: v.image_ids.length,
      texto: v.content ?? "",
      status: v.status,
    });
    if (rule) return rule.mensagem;
  }
  return null;
}

/** The id of each network's variation is kept when the post is saved again. */
function withIds(input: PostInput, current?: Post): PostVariation[] {
  return input.variations.map((v) => ({
    ...v,
    id:
      current?.variations.find((old) => old.network === v.network)?.id ??
      newId("var"),
  }));
}

/** A variation for test data (LinkedIn text draft unless told otherwise). */
function variation(data: Partial<PostVariation> = {}): PostVariation {
  return {
    id: newId("var"),
    network: "linkedin",
    format: "text",
    content: null,
    status: "draft",
    expected_date: null,
    image_ids: [],
    ...data,
  };
}

export const server = setupServer(...handlers);

/** Data helpers for the tests (arrange) and the request log (assert). */
export const fakeApi = {
  reset() {
    db = emptyDb();
    log.length = 0;
  },
  requests: (method?: string, path?: string) =>
    log.filter(
      (r) =>
        (!method || r.method === method) &&
        (!path || r.url.pathname === `/api/v1${path}`),
    ),
  get db() {
    return db;
  },
  addProject(data: Partial<Projeto> = {}): Projeto {
    const project: Projeto = {
      id: newId("proj"),
      name: "Minha marca",
      description: null,
      target_audience: "Pequenas empresas",
      voice_tone: "Didático",
      created_at: now,
      updated_at: now,
      ...data,
    };
    db.projects.push(project);
    return project;
  },
  addSubject(projectId: string, data: Partial<Assunto> = {}): Assunto {
    const subject: Assunto = {
      id: newId("subj"),
      project_id: projectId,
      name: "Cloud",
      description: null,
      target_audience: null,
      voice_tone: null,
      created_at: now,
      updated_at: now,
      ...data,
    };
    db.subjects.push(subject);
    return subject;
  },
  /** A post; `variations` are partial (defaults: LinkedIn text draft). */
  addPost(
    subjectId: string,
    data: Partial<Omit<Post, "variations">> & {
      variations?: Partial<PostVariation>[];
    } = {},
  ): Post {
    const { variations = [{}], ...rest } = data;
    const post: Post = {
      id: newId("post"),
      subject_id: subjectId,
      title: "Post",
      created_at: now,
      updated_at: now,
      ...rest,
      variations: variations.map(variation),
    };
    db.posts.push(post);
    return post;
  },
  addIdea(projectId: string, data: Partial<Idea> = {}): Idea {
    const idea: Idea = {
      id: newId("idea"),
      project_id: projectId,
      title: "Ideia",
      notes: null,
      subject_id: null,
      networks: [],
      source: "manual",
      post_id: null,
      created_at: `${now}#${seq}`,
      updated_at: now,
      ...data,
    };
    db.ideas.push(idea);
    return idea;
  },
  addImage(projectId: string, data: Partial<Imagem> = {}): Imagem {
    const image = {
      id: newId("img"),
      project_id: projectId,
      key: `users/test/projects/${projectId}/images/${seq}.png`,
      content_type: "image/png",
      description: null,
      url: `${S3}/image-${seq}.png`,
      created_at: now,
      updated_at: now,
      ...data,
    };
    db.images.push(image);
    return semChave(image);
  },
};

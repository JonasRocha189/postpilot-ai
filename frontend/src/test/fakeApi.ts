// Fake backend for the integration tests: MSW answers the same routes as the
// FastAPI backend (/api/v1/...) from in-memory data, with the same rules
// (project scoping, 404, 409, 422) and the S3 presigned upload.
import type { Assunto } from "@/features/assuntos/types";
import type { Imagem } from "@/features/imagens/types";
import type { Post } from "@/features/posts/types";
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
    const from = q.get("from");
    const to = q.get("to");
    const posts = db.posts
      .filter((p) => projectOfSubject(p.subject_id) === projectId)
      .filter(
        (p) => !q.get("subject_id") || p.subject_id === q.get("subject_id"),
      )
      .filter((p) => !q.get("status") || p.status === q.get("status"))
      .filter(
        (p) => !from || (p.expected_date !== null && p.expected_date >= from),
      )
      .filter((p) => !to || (p.expected_date !== null && p.expected_date <= to))
      .sort((a, b) => a.title.localeCompare(b.title));
    return HttpResponse.json(posts);
  }),
  http.post(`${API}/posts`, async ({ request }) => {
    const input = await body<Partial<Post>>(request);
    const projectId = projectOfSubject(input.subject_id ?? "");
    if (!projectId) return notFound("Subject");
    if (
      input.image_id &&
      db.images.find((i) => i.id === input.image_id)?.project_id !== projectId
    ) {
      return invalid("Image is not in this project's library");
    }
    const post: Post = {
      id: newId("post"),
      subject_id: input.subject_id!,
      title: input.title ?? "",
      content: input.content ?? null,
      status: input.status ?? "draft",
      expected_date: input.expected_date ?? null,
      image_id: input.image_id ?? null,
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
    Object.assign(post, await body<Partial<Post>>(request));
    return HttpResponse.json(post);
  }),
  http.delete(`${API}/posts/:id`, ({ params }) => {
    db.posts = db.posts.filter((p) => p.id !== params.id);
    return noContent();
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
    if (db.posts.some((p) => p.image_id === params.id))
      return conflict("Image is used by posts");
    db.images = db.images.filter((i) => i.id !== params.id);
    return noContent();
  }),
];

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
  addPost(subjectId: string, data: Partial<Post> = {}): Post {
    const post: Post = {
      id: newId("post"),
      subject_id: subjectId,
      title: "Post",
      content: null,
      status: "draft",
      expected_date: null,
      image_id: null,
      created_at: now,
      updated_at: now,
      ...data,
    };
    db.posts.push(post);
    return post;
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

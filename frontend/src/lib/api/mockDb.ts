// FAKE DATABASE for `npm run dev` without a backend (see lib/api/http.ts).
// Each collection lives in localStorage; each feature's `mock` services
// use these collections and imitate the real API's rules (404, 409...).
import { createScript, type Script } from "@/features/agent/mockScript";
import type { Subject } from "@/features/subjects/types";
import type { ProjectDocument } from "@/features/documents/types";
import { fakeImage } from "@/features/images/fakeImage";
import type { Idea } from "@/features/ideas/types";
import type { Image } from "@/features/images/types";
import type { Metric } from "@/features/metrics/types";
import type { AgentMode, Network } from "@/lib/domain";
import { parseData } from "@/lib/format";
import type { Post } from "@/features/posts/types";
import type { Project } from "@/features/projects/types";
import { ApiError } from "./http";

/** ProjectDocument in the fake database: keeps when processing started. */
export type MockDocument = ProjectDocument & {
  processing_started_at: string | null;
};

/**
 * A run in the fake database: keeps the whole script; the steps "appear"
 * as time goes by (see features/agent/mock.ts).
 */
export type MockRun = {
  id: string;
  project_id: string;
  mode: AgentMode;
  request: string;
  started_at: string;
  script: Script;
  post_id: string | null;
  finished: boolean;
};

type Entity = { id: string };

function collection<T extends Entity>(key: string, seed: () => T[]) {
  let memory: T[] | null = null;

  const read = (): T[] => {
    if (memory) return memory;
    try {
      const saved = localStorage.getItem(key);
      memory = saved ? (JSON.parse(saved) as T[]) : seed();
    } catch {
      memory = seed();
    }
    return memory;
  };

  const write = (items: T[]) => {
    memory = items;
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // localStorage unavailable: the data lasts only in this tab
    }
  };

  return {
    todos: read,
    find(id: string, name = "Registro"): T {
      const item = read().find((i) => i.id === id);
      if (!item) throw new ApiError(404, `${name} não encontrado`);
      return item;
    },
    insert(item: T) {
      write([...read(), item]);
      return item;
    },
    replace(item: T) {
      write(read().map((i) => (i.id === item.id ? item : i)));
      return item;
    },
    remove(id: string) {
      write(read().filter((i) => i.id !== id));
    },
  };
}

/** Simulates network latency. */
export const latency = () => new Promise((resolve) => setTimeout(resolve, 250));

export const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Dados iniciais
// ---------------------------------------------------------------------------

const PROJ_BRAND = "proj-minha-marca";
const PROJ_ACME = "proj-acme";

function seedProjects(): Project[] {
  const now = nowIso();
  return [
    {
      id: PROJ_BRAND,
      name: "Minha marca",
      description:
        "Conteúdo da minha consultoria de tecnologia para pequenas empresas.",
      target_audience: "Donos e gestores de pequenas e médias empresas",
      voice_tone: "Próximo, didático e sem jargão técnico",
      created_at: now,
      updated_at: now,
    },
    {
      id: PROJ_ACME,
      name: "Acme Cloud",
      description: "Cliente: provedor de nuvem focado em segurança.",
      target_audience: "Gestores de TI e CTOs",
      voice_tone: "Profissional, confiante e direto",
      created_at: now,
      updated_at: now,
    },
  ];
}

function seedSubjects(): Subject[] {
  const now = nowIso();
  const subject = (
    id: string,
    project_id: string,
    name: string,
    description: string,
    voice: Partial<Pick<Subject, "target_audience" | "voice_tone">> = {},
  ): Subject => ({
    id,
    project_id,
    name,
    description,
    target_audience: voice.target_audience ?? null,
    voice_tone: voice.voice_tone ?? null,
    created_at: now,
    updated_at: now,
  });
  return [
    subject(
      "ass-cloud",
      PROJ_BRAND,
      "Cloud para PMEs",
      "Migração, custos e boas práticas de nuvem para empresas pequenas.",
    ),
    subject(
      "ass-cultura",
      PROJ_BRAND,
      "Cultura da empresa",
      "Bastidores, time e jeito de trabalhar.",
      {
        voice_tone: "Leve, humano e bem-humorado",
      },
    ),
    subject(
      "ass-eventos",
      PROJ_BRAND,
      "Eventos",
      "Palestras e eventos de que participamos.",
    ),
    subject(
      "ass-seguranca",
      PROJ_ACME,
      "Segurança da informação",
      "Ameaças, prevenção e conformidade.",
      {
        target_audience: "Equipes de segurança e compliance",
      },
    ),
    subject(
      "ass-produto",
      PROJ_ACME,
      "Novidades do produto",
      "Lançamentos e recursos da Acme Cloud.",
    ),
  ];
}

// title, subject, networks, days from today
type SeedPost = [string, string, Network[], number];
const SEED_POSTS: SeedPost[] = [
  ["5 erros ao migrar para a nuvem", "ass-cloud", ["linkedin", "x"], -20],
  ["Bastidores do onboarding", "ass-cultura", ["instagram"], -14],
  ["Backup em nuvem sem complicação", "ass-cloud", ["linkedin"], -9],
  [
    "Nosso time no evento de tecnologia",
    "ass-eventos",
    ["linkedin", "instagram"],
    -3,
  ],
  ["Como medir o ROI de automação", "ass-cloud", ["linkedin"], 2],
  ["Um dia na vida do suporte", "ass-cultura", ["instagram"], 5],
  ["Custos escondidos da nuvem", "ass-cloud", ["linkedin", "x"], 9],
  [
    "Checklist de segurança para o fim do ano",
    "ass-seguranca",
    ["linkedin", "instagram", "x"],
    -6,
  ],
  ["Phishing: 3 sinais de alerta", "ass-seguranca", ["instagram", "x"], 1],
  ["Autenticação em dois fatores", "ass-seguranca", ["linkedin"], 6],
  ["Novo painel de auditoria", "ass-produto", ["linkedin", "x"], 12],
];

/** "YYYY-MM-DD" `days` days from now, in the local time zone. */
function dayIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Library image used by each seed post (post index → id). */
const SEED_POST_IMAGE: Record<number, string> = {
  0: "img-nuvem",
  3: "img-evento",
  7: "img-checklist",
};

// One variation per network of each seed post. The second network of a post
// is scheduled a day later, so the calendar shows variations on their own dates.
function seedPosts(): Post[] {
  return SEED_POSTS.map(([title, subject_id, networks, days], i) => {
    const now = nowIso();
    const image = SEED_POST_IMAGE[i];
    return {
      id: `post-${i + 1}`,
      subject_id,
      title,
      variations: networks.map((network, j) => ({
        id: `var-${i + 1}-${network}`,
        network: network,
        format: image || network === "instagram" ? "single" : "text",
        content: `${title}. Texto de exemplo para ${network}.`,
        status: days + j < 0 ? "published" : i % 2 === 0 ? "approved" : "draft",
        expected_date: dayIn(days + j),
        image_ids: image ? [image] : [],
      })),
      created_at: now,
      updated_at: now,
    };
  });
}

function seedDocuments(): MockDocument[] {
  const doc = (
    id: string,
    project_id: string,
    name: string,
    type: ProjectDocument["type"],
    size_bytes: number,
    chunk_count: number,
    daysAgo: number,
  ): MockDocument => {
    const data = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    return {
      id,
      project_id,
      name,
      type,
      size_bytes,
      status: "ready",
      error_message: null,
      chunk_count,
      created_at: data,
      updated_at: data,
      processing_started_at: data,
    };
  };
  return [
    doc("doc-guia", PROJ_BRAND, "guia-de-marca.pdf", "pdf", 1_240_000, 38, 20),
    doc(
      "doc-cases",
      PROJ_BRAND,
      "cases-de-clientes.docx",
      "docx",
      486_000,
      22,
      12,
    ),
    doc(
      "doc-auditoria",
      PROJ_ACME,
      "auditoria-seguranca-2026.pdf",
      "pdf",
      3_150_000,
      96,
      9,
    ),
    doc("doc-faq", PROJ_ACME, "faq-produto.txt", "txt", 42_000, 7, 4),
  ];
}

function seedRuns(): MockRun[] {
  const projects = seedProjects();
  const exec = (
    id: string,
    projectId: string,
    mode: AgentMode,
    request: string,
    subject: { id: string; name: string } | null,
    documents: string[],
    hoursAgo: number,
    post_id: string | null = null,
  ): MockRun => {
    const project = projects.find((p) => p.id === projectId)!;
    return {
      id,
      project_id: projectId,
      mode,
      request,
      started_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
      script: createScript({ mode, request, project, subject, documents }),
      post_id,
      finished: true,
    };
  };
  return [
    exec(
      "exec-1",
      PROJ_ACME,
      "creation",
      "Post sobre o checklist de segurança, com base no PDF da auditoria",
      { id: "ass-seguranca", name: "Segurança da informação" },
      ["auditoria-seguranca-2026.pdf"],
      1,
      "post-8",
    ),
    exec(
      "exec-2",
      PROJ_ACME,
      "ideation",
      "Temas para a próxima semana sobre segurança em nuvem",
      null,
      [],
      6,
    ),
    exec(
      "exec-3",
      PROJ_ACME,
      "ideation",
      "O que está funcionando melhor no LinkedIn? #error",
      null,
      [],
      30,
    ),
    exec(
      "exec-4",
      PROJ_BRAND,
      "creation",
      "Carrossel do Instagram sobre onboarding #limite",
      { id: "ass-cultura", name: "Cultura da empresa" },
      [],
      26,
    ),
    exec(
      "exec-5",
      PROJ_BRAND,
      "ideation",
      "Ideias de posts para pequenas empresas que querem migrar para a nuvem",
      null,
      [],
      50,
    ),
  ];
}

/** Library images of each project; some already used by posts. */
function seedImages(): Image[] {
  const created_at = nowIso();
  const image = (
    id: string,
    project_id: string,
    description: string,
  ): Image => ({
    id,
    project_id,
    content_type: "image/svg+xml",
    description,
    url: fakeImage(id),
    created_at,
    updated_at: created_at,
  });
  return [
    image("img-nuvem", PROJ_BRAND, "Servidores migrando para a nuvem"),
    image("img-evento", PROJ_BRAND, "Equipe no evento de tecnologia"),
    image("img-escritorio", PROJ_BRAND, "Escritório com o time trabalhando"),
    image("img-checklist", PROJ_ACME, "Checklist de segurança"),
    image("img-cadeado", PROJ_ACME, "Cadeado digital sobre fundo azul"),
  ];
}

/** Metrics of the published posts: one record 1 day and another 7 days after publishing. */
function seedMetrics(): Metric[] {
  const factor = { linkedin: 1, instagram: 1.6, x: 0.7 } as const;
  return seedPosts()
    .flatMap((post) => post.variations)
    .filter((v) => v.status === "published" && v.expected_date)
    .flatMap((v, i) => {
      const published = parseData(v.expected_date!);
      const base = (900 + ((i * 7919) % 9) * 260) * factor[v.network];
      return [1, 7]
        .map((days) => ({
          days,
          collectedAt: new Date(published.getTime() + days * 86_400_000),
        }))
        .filter(({ collectedAt }) => collectedAt.getTime() <= Date.now())
        .map(({ days, collectedAt }): Metric => {
          const impressions = Math.round(base * (days === 1 ? 0.6 : 1));
          const rate = 0.02 + ((i * 31) % 5) / 100;
          return {
            id: `met-${v.id}-${days}`,
            variation_id: v.id,
            published_at: published.toISOString(),
            impressions,
            likes: Math.round(impressions * rate * 0.6),
            comments: Math.round(impressions * rate * 0.12),
            shares: Math.round(impressions * rate * 0.08),
            clicks: Math.round(impressions * rate * 0.2),
            collected_at: collectedAt.toISOString(),
          };
        });
    });
}

/** Sample ideas: open ones (manual and from the agent) and one already used. */
function seedIdeas(): Idea[] {
  const now = nowIso();
  const idea = (
    id: string,
    project_id: string,
    title: string,
    notes: string | null,
    subject_id: string | null,
    networks: Network[],
    source: Idea["source"],
    post_id: string | null = null,
  ): Idea => ({
    id,
    project_id,
    title,
    notes,
    subject_id,
    networks,
    source,
    post_id,
    created_at: now,
    updated_at: now,
  });
  return [
    idea(
      "idea-finops",
      PROJ_BRAND,
      "FinOps em 5 passos para PMEs",
      "Carrossel com um passo por slide; fechar com um checklist.",
      "ass-cloud",
      ["linkedin", "instagram"],
      "manual",
    ),
    idea(
      "idea-natal",
      PROJ_ACME,
      "Golpes de fim de ano: como se proteger",
      "Tema sazonal (dezembro). Pesquisa web: aumento de phishing nas compras de Natal.",
      "ass-seguranca",
      ["instagram", "x"],
      "agent",
    ),
    idea(
      "idea-bastidores",
      PROJ_ACME,
      "Bastidores de um deploy sem downtime",
      null,
      null,
      [],
      "agent",
    ),
    idea(
      "idea-custos",
      PROJ_BRAND,
      "Custos escondidos da nuvem",
      "Virou o post de mesmo nome.",
      "ass-cloud",
      ["linkedin", "x"],
      "manual",
      "post-7",
    ),
  ];
}

// ---------------------------------------------------------------------------

export const mockDb = {
  projects: collection<Project>("postpilot:mock:v2:projetos", seedProjects),
  subjects: collection<Subject>("postpilot:mock:v2:assuntos", seedSubjects),
  // v3: posts with variations (older browser data had one network per post)
  posts: collection<Post>("postpilot:mock:v3:posts", seedPosts),
  // v3: documents and runs with the English API fields (type, steps, request...)
  documents: collection<MockDocument>(
    "postpilot:mock:v3:documentos",
    seedDocuments,
  ),
  runs: collection<MockRun>("postpilot:mock:v3:execucoes", seedRuns),
  images: collection<Image>("postpilot:mock:v2:imagens", seedImages),
  metrics: collection<Metric>("postpilot:mock:v3:metricas", seedMetrics),
  ideas: collection<Idea>("postpilot:mock:v1:ideas", seedIdeas),
};

/** Finds the variation and its post, or answers 404 like the API. */
export function mockVariation(variationId: string) {
  for (const post of mockDb.posts.todos()) {
    const variation = post.variations.find((v) => v.id === variationId);
    if (variation) return { post, variation };
  }
  throw new ApiError(404, "Variation not found");
}

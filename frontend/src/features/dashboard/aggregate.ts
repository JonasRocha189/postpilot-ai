import type { AgentRun } from "@/features/agente/types";
import type { Post } from "@/features/posts/types";
import { REDES } from "@/features/posts/redes";
import type { Rede, StatusPost } from "@/lib/dominio";
import type {
  CelulaDiaHorario,
  DadosDashboard,
  ExecucaoResumo,
  FaixaHorario,
  Interacoes,
  MetricasGrupo,
  PostPerformance,
  ProximoPost,
} from "./types";

// Turns the API responses into what each widget shows. Pure functions: tested
// without React or network (aggregate.test.ts).

const UPCOMING_LIMIT = 5;
const RUNS_LIMIT = 5;

/** The band of a local hour (same as the agent's time_of_day) */
export function timeBand(hour: number): FaixaHorario {
  if (hour < 6) return "madrugada";
  if (hour < 12) return "manha";
  if (hour < 18) return "tarde";
  return "noite";
}

type Numbers = Interacoes & { posts: number; impressoes: number };

const zero = (): Numbers => ({
  posts: 0,
  impressoes: 0,
  curtidas: 0,
  comentarios: 0,
  compartilhamentos: 0,
  cliques: 0,
});

function add(total: Numbers, post: PostPerformance): Numbers {
  return {
    posts: total.posts + 1,
    impressoes: total.impressoes + post.impressions,
    curtidas: total.curtidas + post.likes,
    comentarios: total.comentarios + post.comments,
    compartilhamentos: total.compartilhamentos + post.shares,
    cliques: total.cliques + post.clicks,
  };
}

function groupBy<K>(
  posts: PostPerformance[],
  key: (post: PostPerformance) => K,
): Map<K, Numbers> {
  const groups = new Map<K, Numbers>();
  for (const post of posts) {
    const k = key(post);
    groups.set(k, add(groups.get(k) ?? zero(), post));
  }
  return groups;
}

/** Totals per network (in the app's network order), subject and day × band. */
export function groupPerformance(
  posts: PostPerformance[],
): DadosDashboard["desempenho"] {
  const byNetwork = groupBy(posts, (p) => p.network);
  const porRede = REDES.filter((rede) => byNetwork.has(rede)).map((rede) => ({
    grupo: rede,
    ...byNetwork.get(rede)!,
  }));

  const porAssunto: MetricasGrupo[] = [...groupBy(posts, (p) => p.subject)].map(
    ([grupo, numbers]) => ({ grupo, ...numbers }),
  );

  // The API uses ISO weekdays (7 = Sunday); the chart uses 0 = Sunday
  const byCell = groupBy(posts, (p) => `${p.weekday % 7}|${timeBand(p.hour)}`);
  const porDiaHorario: CelulaDiaHorario[] = [...byCell].map(
    ([key, numbers]) => {
      const [dia, faixa] = key.split("|");
      return { dia: Number(dia), faixa: faixa as FaixaHorario, ...numbers };
    },
  );

  return { porRede, porAssunto, porDiaHorario };
}

/** How many variations are in each status (a post counts once per network). */
export function countByStatus(posts: Post[]): Record<StatusPost, number> {
  const counts: Record<StatusPost, number> = {
    draft: 0,
    review: 0,
    approved: 0,
    published: 0,
  };
  for (const post of posts) {
    for (const variation of post.variations) counts[variation.status] += 1;
  }
  return counts;
}

/**
 * Posts with a variation expected from today on and not published yet, by the
 * nearest date. `today` is YYYY-MM-DD in the user's time zone.
 */
export function upcomingPosts(
  posts: Post[],
  subjectNames: Map<string, string>,
  today: string,
): ProximoPost[] {
  const upcoming: ProximoPost[] = [];
  for (const post of posts) {
    const pending = post.variations.filter(
      (v) =>
        v.expected_date !== null &&
        v.expected_date >= today &&
        v.status !== "published",
    );
    if (pending.length === 0) continue;
    const first = pending.reduce((a, b) =>
      a.expected_date! <= b.expected_date! ? a : b,
    );
    upcoming.push({
      id: post.id,
      title: post.title,
      assunto: subjectNames.get(post.subject_id) ?? "",
      redes: pending.map((v) => v.network as Rede),
      status: first.status,
      // Local midnight: a bare YYYY-MM-DD would be read as UTC (the day before in Brazil)
      dataPrevista: `${first.expected_date}T00:00:00`,
    });
  }
  return upcoming
    .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista))
    .slice(0, UPCOMING_LIMIT);
}

/** The most recent runs (the API already sends them newest first). */
export function latestRuns(runs: AgentRun[]): ExecucaoResumo[] {
  return runs.slice(0, RUNS_LIMIT).map((run) => ({
    id: run.id,
    mode: run.mode,
    request: run.request,
    status: run.status,
    steps: run.steps.length,
    iniciadaEm: run.started_at,
  }));
}

/** Today as YYYY-MM-DD in the user's time zone */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

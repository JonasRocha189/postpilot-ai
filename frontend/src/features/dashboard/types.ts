import type {
  ModoAgente,
  Rede,
  StatusExecucao,
  StatusPost,
} from "@/lib/dominio";

// What the dashboard widgets show, built from GET /posts, GET /agent/runs and
// GET /reports/performance (see aggregate.ts).

export type Interacoes = {
  curtidas: number;
  comentarios: number;
  compartilhamentos: number;
  cliques: number;
};

export type MetricasGrupo = Interacoes & {
  grupo: string;
  posts: number;
  impressoes: number;
};

/** Same bands as the agent's analyze_performance (madrugada = 0h–6h) */
export type FaixaHorario = "madrugada" | "manha" | "tarde" | "noite";

/** dia: 0 = domingo ... 6 = sábado */
export type CelulaDiaHorario = Interacoes & {
  dia: number;
  faixa: FaixaHorario;
  posts: number;
  impressoes: number;
};

export type ProximoPost = {
  id: string;
  title: string;
  assunto: string;
  redes: Rede[];
  status: StatusPost;
  dataPrevista: string; // ISO
};

export type ExecucaoResumo = {
  id: string;
  mode: ModoAgente;
  request: string;
  status: StatusExecucao;
  steps: number;
  iniciadaEm: string; // ISO
};

export type DadosDashboard = {
  postsPorStatus: Record<StatusPost, number>;
  proximosPosts: ProximoPost[];
  ultimasExecucoes: ExecucaoResumo[];
  desempenho: {
    porRede: (MetricasGrupo & { grupo: Rede })[];
    porAssunto: MetricasGrupo[];
    porDiaHorario: CelulaDiaHorario[];
  };
};

// --- GET /reports/performance (mirrors backend/schemas/reports.py) ----------

/** The latest numbers of one published variation */
export type PostPerformance = {
  variation_id: string;
  post_id: string;
  title: string;
  subject: string;
  network: Rede;
  published_at: string;
  /** In the report's time zone: ISO weekday (1 = Monday ... 7 = Sunday) */
  weekday: number;
  /** In the report's time zone: 0-23 */
  hour: number;
  has_image: boolean;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
};

export type PerformanceReport = {
  timezone: string;
  /** Groups with fewer posts support no conclusion */
  min_sample: number;
  posts: PostPerformance[];
};

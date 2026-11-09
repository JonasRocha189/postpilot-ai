import type {
  ModoAgente,
  Rede,
  StatusExecucao,
  StatusPost,
} from "@/lib/dominio";

// Formato provisório da response do dashboard. Ajustar quando a API existir
// (GET /posts, GET /agent/runs e GET /reports/performance).

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

export type FaixaHorario = "manha" | "tarde" | "noite";

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

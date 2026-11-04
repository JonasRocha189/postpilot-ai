// BANCO FICTÍCIO para `npm run dev` sem backend (ver lib/api/http.ts).
// Cada coleção fica no localStorage; os services `mock` de cada feature
// usam estas coleções e imitam as regras da API real (404, 409...).
import { criarRoteiro, type Roteiro } from "@/features/agente/mockRoteiro";
import type { Assunto } from "@/features/assuntos/types";
import type { Documento } from "@/features/documentos/types";
import { imagemFicticia } from "@/features/imagens/ficticia";
import type { Imagem } from "@/features/imagens/types";
import type { Metrica } from "@/features/metricas/types";
import type { ModoAgente, Rede } from "@/lib/dominio";
import { parseData } from "@/lib/format";
import type { Post } from "@/features/posts/types";
import type { Projeto } from "@/features/projetos/types";
import { ApiError } from "./http";

/** Documento no banco fictício: guarda quando o processamento começou. */
export type DocumentoMock = Documento & {
  processamento_iniciado_em: string | null;
};

/**
 * Execução no banco fictício: guarda o roteiro inteiro; os passos vão
 * "aparecendo" conforme o tempo passa (ver features/agente/mock.ts).
 */
export type ExecucaoMock = {
  id: string;
  project_id: string;
  modo: ModoAgente;
  pedido: string;
  iniciada_em: string;
  roteiro: Roteiro;
  post_id: string | null;
  finalizada: boolean;
};

type Entidade = { id: string };

function colecao<T extends Entidade>(key: string, seed: () => T[]) {
  let memoria: T[] | null = null;

  const ler = (): T[] => {
    if (memoria) return memoria;
    try {
      const salvo = localStorage.getItem(key);
      memoria = salvo ? (JSON.parse(salvo) as T[]) : seed();
    } catch {
      memoria = seed();
    }
    return memoria;
  };

  const gravar = (itens: T[]) => {
    memoria = itens;
    try {
      localStorage.setItem(key, JSON.stringify(itens));
    } catch {
      // localStorage indisponível: os dados duram só nesta aba
    }
  };

  return {
    todos: ler,
    encontrar(id: string, name = "Registro"): T {
      const item = ler().find((i) => i.id === id);
      if (!item) throw new ApiError(404, `${name} não encontrado`);
      return item;
    },
    inserir(item: T) {
      gravar([...ler(), item]);
      return item;
    },
    substituir(item: T) {
      gravar(ler().map((i) => (i.id === item.id ? item : i)));
      return item;
    },
    remover(id: string) {
      gravar(ler().filter((i) => i.id !== id));
    },
  };
}

/** Simula a latência da rede. */
export const latencia = () =>
  new Promise((resolve) => setTimeout(resolve, 250));

export const agoraIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Dados iniciais
// ---------------------------------------------------------------------------

const PROJ_MARCA = "proj-minha-marca";
const PROJ_ACME = "proj-acme";

function seedProjetos(): Projeto[] {
  const agora = agoraIso();
  return [
    {
      id: PROJ_MARCA,
      name: "Minha marca",
      description:
        "Conteúdo da minha consultoria de tecnologia para pequenas empresas.",
      target_audience: "Donos e gestores de pequenas e médias empresas",
      voice_tone: "Próximo, didático e sem jargão técnico",
      created_at: agora,
      updated_at: agora,
    },
    {
      id: PROJ_ACME,
      name: "Acme Cloud",
      description: "Cliente: provedor de nuvem focado em segurança.",
      target_audience: "Gestores de TI e CTOs",
      voice_tone: "Profissional, confiante e direto",
      created_at: agora,
      updated_at: agora,
    },
  ];
}

function seedAssuntos(): Assunto[] {
  const agora = agoraIso();
  const assunto = (
    id: string,
    project_id: string,
    name: string,
    description: string,
    voz: Partial<Pick<Assunto, "target_audience" | "voice_tone">> = {},
  ): Assunto => ({
    id,
    project_id,
    name,
    description,
    target_audience: voz.target_audience ?? null,
    voice_tone: voz.voice_tone ?? null,
    created_at: agora,
    updated_at: agora,
  });
  return [
    assunto(
      "ass-cloud",
      PROJ_MARCA,
      "Cloud para PMEs",
      "Migração, custos e boas práticas de nuvem para empresas pequenas.",
    ),
    assunto(
      "ass-cultura",
      PROJ_MARCA,
      "Cultura da empresa",
      "Bastidores, time e jeito de trabalhar.",
      {
        voice_tone: "Leve, humano e bem-humorado",
      },
    ),
    assunto(
      "ass-eventos",
      PROJ_MARCA,
      "Eventos",
      "Palestras e eventos de que participamos.",
    ),
    assunto(
      "ass-seguranca",
      PROJ_ACME,
      "Segurança da informação",
      "Ameaças, prevenção e conformidade.",
      {
        target_audience: "Equipes de segurança e compliance",
      },
    ),
    assunto(
      "ass-produto",
      PROJ_ACME,
      "Novidades do produto",
      "Lançamentos e recursos da Acme Cloud.",
    ),
  ];
}

// título, assunto, redes, dias a partir de hoje
type SeedPost = [string, string, Rede[], number];
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

/** "AAAA-MM-DD" daqui a `dias` dias, no fuso local. */
function diaDaquiA(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Imagem da biblioteca usada por cada post do seed (índice do post → id). */
const SEED_IMAGEM_DO_POST: Record<number, string> = {
  0: "img-nuvem",
  3: "img-evento",
  7: "img-checklist",
};

function seedPosts(): Post[] {
  return SEED_POSTS.map(([title, subject_id, redes, dias], i) => {
    const agora = agoraIso();
    return {
      id: `post-${i + 1}`,
      subject_id,
      title,
      content: `${title}. Texto de exemplo.`,
      status: dias < 0 ? "published" : i % 2 === 0 ? "approved" : "draft",
      expected_date: diaDaquiA(dias),
      network: redes[0],
      format: SEED_IMAGEM_DO_POST[i] || redes[0] === "instagram" ? "single" : "text",
      image_ids: SEED_IMAGEM_DO_POST[i] ? [SEED_IMAGEM_DO_POST[i]] : [],
      created_at: agora,
      updated_at: agora,
    };
  });
}

/**
 * Variações por rede, só para as imagens e métricas fictícias. O backend
 * ainda não tem variações, então o Post não as carrega.
 */
type VariacaoMock = { id: string; post_id: string; rede: Rede };
const SEED_VARIACOES: VariacaoMock[] = SEED_POSTS.flatMap(([, , redes], i) =>
  redes.map((rede) => ({
    id: `var-${i + 1}-${rede}`,
    post_id: `post-${i + 1}`,
    rede,
  })),
);

function seedDocumentos(): DocumentoMock[] {
  const doc = (
    id: string,
    project_id: string,
    name: string,
    tipo: Documento["tipo"],
    tamanho_bytes: number,
    total_chunks: number,
    diasAtras: number,
  ): DocumentoMock => {
    const data = new Date(Date.now() - diasAtras * 86_400_000).toISOString();
    return {
      id,
      project_id,
      name,
      tipo,
      tamanho_bytes,
      status: "ready",
      mensagem_erro: null,
      total_chunks,
      created_at: data,
      updated_at: data,
      processamento_iniciado_em: data,
    };
  };
  return [
    doc("doc-guia", PROJ_MARCA, "guia-de-marca.pdf", "pdf", 1_240_000, 38, 20),
    doc(
      "doc-cases",
      PROJ_MARCA,
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

function seedExecucoes(): ExecucaoMock[] {
  const projetos = seedProjetos();
  const exec = (
    id: string,
    projetoId: string,
    modo: ModoAgente,
    pedido: string,
    assunto: { id: string; name: string } | null,
    documentos: string[],
    horasAtras: number,
    post_id: string | null = null,
  ): ExecucaoMock => {
    const projeto = projetos.find((p) => p.id === projetoId)!;
    return {
      id,
      project_id: projetoId,
      modo,
      pedido,
      iniciada_em: new Date(Date.now() - horasAtras * 3_600_000).toISOString(),
      roteiro: criarRoteiro({ modo, pedido, projeto, assunto, documentos }),
      post_id,
      finalizada: true,
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
      "O que está funcionando melhor no LinkedIn? #erro",
      null,
      [],
      30,
    ),
    exec(
      "exec-4",
      PROJ_MARCA,
      "creation",
      "Carrossel do Instagram sobre onboarding #limite",
      { id: "ass-cultura", name: "Cultura da empresa" },
      [],
      26,
    ),
    exec(
      "exec-5",
      PROJ_MARCA,
      "ideation",
      "Ideias de posts para pequenas empresas que querem migrar para a nuvem",
      null,
      [],
      50,
    ),
  ];
}

/** Imagens da biblioteca de cada projeto; algumas já usadas por posts. */
function seedImagens(): Imagem[] {
  const created_at = agoraIso();
  const imagem = (
    id: string,
    project_id: string,
    description: string,
  ): Imagem => ({
    id,
    project_id,
    content_type: "image/svg+xml",
    description,
    url: imagemFicticia(id),
    created_at,
    updated_at: created_at,
  });
  return [
    imagem("img-nuvem", PROJ_MARCA, "Servidores migrando para a nuvem"),
    imagem("img-evento", PROJ_MARCA, "Equipe no evento de tecnologia"),
    imagem("img-escritorio", PROJ_MARCA, "Escritório com o time trabalhando"),
    imagem("img-checklist", PROJ_ACME, "Checklist de segurança"),
    imagem("img-cadeado", PROJ_ACME, "Cadeado digital sobre fundo azul"),
  ];
}

/** Métricas dos posts publicados: um registro 1 dia e outro 7 dias após publicar. */
function seedMetricas(): Metrica[] {
  const fator = { linkedin: 1, instagram: 1.6, x: 0.7 } as const;
  const posts = seedPosts();
  return posts
    .filter((p) => p.status === "published" && p.expected_date)
    .flatMap((post, i) =>
      SEED_VARIACOES.filter((v) => v.post_id === post.id).flatMap((v) => {
        const publicado = parseData(post.expected_date!);
        const base = (900 + ((i * 7919) % 9) * 260) * fator[v.rede];
        return [1, 7]
          .map((dias) => ({
            dias,
            coleta: new Date(publicado.getTime() + dias * 86_400_000),
          }))
          .filter(({ coleta }) => coleta.getTime() <= Date.now())
          .map(({ dias, coleta }): Metrica => {
            const impressoes = Math.round(base * (dias === 1 ? 0.6 : 1));
            const taxa = 0.02 + ((i * 31) % 5) / 100;
            return {
              id: `met-${v.id}-${dias}`,
              variacao_id: v.id,
              publicado_em: publicado.toISOString(),
              impressoes,
              curtidas: Math.round(impressoes * taxa * 0.6),
              comentarios: Math.round(impressoes * taxa * 0.12),
              compartilhamentos: Math.round(impressoes * taxa * 0.08),
              cliques: Math.round(impressoes * taxa * 0.2),
              coletado_em: coleta.toISOString(),
            };
          });
      }),
    );
}

// ---------------------------------------------------------------------------

export const mockDb = {
  projetos: colecao<Projeto>("postpilot:mock:v2:projetos", seedProjetos),
  assuntos: colecao<Assunto>("postpilot:mock:v2:assuntos", seedAssuntos),
  posts: colecao<Post>("postpilot:mock:v2:posts", seedPosts),
  documentos: colecao<DocumentoMock>(
    "postpilot:mock:v2:documentos",
    seedDocumentos,
  ),
  execucoes: colecao<ExecucaoMock>(
    "postpilot:mock:v2:execucoes",
    seedExecucoes,
  ),
  imagens: colecao<Imagem>("postpilot:mock:v2:imagens", seedImagens),
  metricas: colecao<Metrica>("postpilot:mock:v2:metricas", seedMetricas),
};

/** Encontra a variação e o post dela, ou responde 404 como a API. */
export function variacaoDoMock(variacaoId: string) {
  const variacao = SEED_VARIACOES.find((v) => v.id === variacaoId);
  const post =
    variacao && mockDb.posts.todos().find((p) => p.id === variacao.post_id);
  if (!variacao || !post) throw new ApiError(404, "Variação não encontrada");
  return { post, variacao };
}

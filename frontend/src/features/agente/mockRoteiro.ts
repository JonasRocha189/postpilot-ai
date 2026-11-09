// Scripts of the mock agent (only for `npm run dev` without a backend).
// Builds, without side effects, the steps the agent "would run" for a request.
// Words in the request force test scenarios: "#error" (a tool fails) and
// "#limite" (the iteration limit is reached).
import type { ModoAgente, Rede, StatusExecucao } from "@/lib/dominio";
import { MAX_ITERATIONS, type AgentStep } from "./types";

export type PassoRoteiro = Omit<AgentStep, "id" | "step_number"> & {
  /** Chamada em paralelo com a anterior, na mesma iteração do loop */
  paralelo?: boolean;
};

export type Roteiro = {
  steps: PassoRoteiro[];
  statusFinal: Exclude<StatusExecucao, "running">;
  response: string | null;
  /** Em criação: dados do rascunho que o agente salva no final */
  rascunho: { title: string; subject_id: string; redes: Rede[]; texto: string } | null;
};

export type ContextoRoteiro = {
  mode: ModoAgente;
  request: string;
  projeto: { name: string; voice_tone: string | null; target_audience: string | null };
  assunto: { id: string; name: string } | null;
  documentos: string[];
};

const passo = (
  tool: string,
  args: Record<string, unknown>,
  result_summary: string,
  duration_ms: number,
): PassoRoteiro => ({ tool, arguments: args, result_summary, duration_ms, error: null });

function resumir(request: string, max = 60) {
  const limpo = request.replace(/#\w+/g, "").trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

export function criarRoteiro(ctx: ContextoRoteiro): Roteiro {
  const consulta = resumir(ctx.request, 40);
  const comErro = ctx.request.includes("#error");
  const noLimite = ctx.request.includes("#limite");

  const inicio: PassoRoteiro[] = [
    passo(
      "get_project",
      {},
      `${ctx.projeto.name} · tom: ${ctx.projeto.voice_tone ?? "não definido"}`,
      110,
    ),
  ];

  // Cenário: o agente não termina dentro do limite de iterações
  if (noLimite) {
    const steps = [...inicio];
    for (let i = steps.length; i < MAX_ITERATIONS; i++) {
      steps.push(
        passo("search_web", { query: `${consulta} (${i})` }, "5 resultados, nenhum conclusivo", 900),
      );
    }
    return {
      steps,
      statusFinal: "limit_reached",
      response: null,
      rascunho: null,
    };
  }

  if (ctx.mode === "ideation") {
    const steps: PassoRoteiro[] = [
      ...inicio,
      passo(
        "analyze_performance",
        {},
        "Melhor taxa: LinkedIn às terças de manhã (6,6%). Assuntos com menos de 5 posts sem conclusão.",
        420,
      ),
      passo(
        "search_past_posts",
        { assunto: ctx.assunto?.name ?? "todos" },
        "3 posts aprovados como referência de estilo",
        150,
      ),
      comErro
        ? { ...passo("search_web", { query: consulta }, "", 1800), result_summary: null, error: "Tempo esgotado ao consultar o serviço de busca" }
        : passo("search_web", { query: consulta }, "6 fontes: blogs do setor, notícias da semana e um relatório de mercado", 1300),
    ];
    if (comErro) return { steps, statusFinal: "error", response: null, rascunho: null };
    return {
      steps,
      statusFinal: "completed",
      rascunho: null,
      response: [
        `Aqui estão 5 ideias para o projeto ${ctx.projeto.name}:`,
        "",
        "1. Os 3 erros mais comuns ao começar — formato de lista, bom para LinkedIn.",
        "2. Bastidores: como o time resolve um problema real — carrossel no Instagram.",
        "3. Mito ou verdade? Uma pergunta rápida com enquete — X.",
        "4. Checklist prático em 5 passos, com base nos seus documentos.",
        "5. Comentário sobre uma notícia da semana encontrada na pesquisa.",
        "",
        "Seus posts no LinkedIn às terças de manhã tiveram o melhor engajamento (6,6%); vale publicar as ideias 1 e 4 nesse horário.",
        "Fontes: as pesquisas na web estão no passo 4 desta execução.",
      ].join("\n"),
    };
  }

  // Criação
  if (!ctx.assunto) {
    return {
      steps: [
        ...inicio,
        { ...passo("list_subjects", {}, "", 80), result_summary: null, error: "O projeto não tem assuntos cadastrados" },
      ],
      statusFinal: "error",
      response: null,
      rascunho: null,
    };
  }

  const redes: Rede[] = ctx.request.toLowerCase().includes("instagram")
    ? ["instagram", "linkedin"]
    : ["linkedin", "x"];
  const doc = ctx.documentos[0];
  const titulo = resumir(ctx.request) || "Post criado pelo agente";

  const steps: PassoRoteiro[] = [
    ...inicio,
    passo("get_subject", { id: ctx.assunto.id }, `${ctx.assunto.name} · voz do projeto`, 90),
    passo(
      "search_documents",
      { query: consulta },
      doc ? `4 trechos relevantes de ${doc}` : "Nenhum documento pronto no projeto; seguindo sem RAG",
      380,
    ),
    passo("search_past_posts", { assunto: ctx.assunto.name }, "3 posts aprovados como referência de estilo", 140),
    // O LLM pede a adaptação para todas as redes de uma vez (mesma iteração)
    ...redes.map((rede, i) => ({
      ...passo("adapt_for_network", { rede }, rede === "x" ? "264 caracteres (limite 280)" : "1.180 caracteres", 60),
      paralelo: i > 0,
    })),
    comErro
      ? { ...passo("generate_image", { formato: "1:1" }, "", 4100), result_summary: null, error: "O provedor de imagem recusou o prompt" }
      : passo("generate_image", { formato: "1:1", prompt: `ilustração sobre ${consulta}, sem texto` }, "Imagem 1080×1080 salva", 4100),
  ];
  if (comErro) return { steps, statusFinal: "error", response: null, rascunho: null };

  steps.push(passo("save_draft", { titulo }, "Post salvo como rascunho", 70));

  return {
    steps,
    statusFinal: "completed",
    rascunho: {
      title: titulo,
      subject_id: ctx.assunto.id,
      redes,
      texto: `${titulo}.\n\nTexto gerado pelo agente${doc ? ` com base em ${doc}` : ""}, no tom "${ctx.projeto.voice_tone ?? "padrão"}".`,
    },
    response: [
      `Pronto! Escrevi o post "${titulo}" para ${redes.map((r) => (r === "x" ? "X" : r === "linkedin" ? "LinkedIn" : "Instagram")).join(" e ")}.`,
      doc ? `Usei trechos de ${doc} e o estilo de 3 posts aprovados.` : "Não havia documentos prontos, então usei só o estilo dos posts aprovados.",
      "Salvei como rascunho: revise o texto e a imagem antes de aprovar.",
    ].join("\n"),
  };
}

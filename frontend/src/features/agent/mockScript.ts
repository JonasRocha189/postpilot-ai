// Scripts of the mock agent (only for `npm run dev` without a backend).
// Builds, without side effects, the steps the agent "would run" for a request.
// Words in the request force test scenarios: "#error" (a tool fails) and
// "#limite" (the iteration limit is reached).
import type { AgentMode, Network, RunStatus } from "@/lib/domain";
import { MAX_ITERATIONS, type AgentStep } from "./types";

export type ScriptStep = Omit<AgentStep, "id" | "step_number"> & {
  /** Called in parallel with the previous one, in the same loop iteration */
  parallel?: boolean;
};

export type Script = {
  steps: ScriptStep[];
  statusFinal: Exclude<RunStatus, "running">;
  response: string | null;
  /** In creation: the draft the agent saves at the end */
  draft: {
    title: string;
    subject_id: string;
    networks: Network[];
    text: string;
  } | null;
};

export type ScriptContext = {
  mode: AgentMode;
  request: string;
  project: {
    name: string;
    voice_tone: string | null;
    target_audience: string | null;
  };
  subject: { id: string; name: string } | null;
  documents: string[];
};

const step = (
  tool: string,
  args: Record<string, unknown>,
  result_summary: string,
  duration_ms: number,
): ScriptStep => ({
  tool,
  arguments: args,
  result_summary,
  duration_ms,
  error: null,
});

function summarize(request: string, max = 60) {
  const clean = request.replace(/#\w+/g, "").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function createScript(ctx: ScriptContext): Script {
  const query = summarize(ctx.request, 40);
  const withError = ctx.request.includes("#error");
  const atLimit = ctx.request.includes("#limite");

  const start: ScriptStep[] = [
    step(
      "get_project",
      {},
      `${ctx.project.name} · tom: ${ctx.project.voice_tone ?? "não defined"}`,
      110,
    ),
  ];

  // Scenario: the agent doesn't finish within the iteration limit
  if (atLimit) {
    const steps = [...start];
    for (let i = steps.length; i < MAX_ITERATIONS; i++) {
      steps.push(
        step(
          "search_web",
          { query: `${query} (${i})` },
          "5 resultados, nenhum conclusivo",
          900,
        ),
      );
    }
    return {
      steps,
      statusFinal: "limit_reached",
      response: null,
      draft: null,
    };
  }

  if (ctx.mode === "ideation") {
    const steps: ScriptStep[] = [
      ...start,
      step(
        "analyze_performance",
        {},
        "Melhor taxa: LinkedIn às terças de manhã (6,6%). Assuntos com menos de 5 posts sem conclusão.",
        420,
      ),
      step(
        "search_past_posts",
        { subject: ctx.subject?.name ?? "todos" },
        "3 posts aprovados como referência de estilo",
        150,
      ),
      withError
        ? {
            ...step("search_web", { query: query }, "", 1800),
            result_summary: null,
            error: "Tempo esgotado ao consultar o serviço de busca",
          }
        : step(
            "search_web",
            { query: query },
            "6 fontes: blogs do setor, notícias da semana e um relatório de mercado",
            1300,
          ),
    ];
    if (withError)
      return { steps, statusFinal: "error", response: null, draft: null };
    return {
      steps,
      statusFinal: "completed",
      draft: null,
      response: [
        `Aqui estão 5 ideias para o projeto ${ctx.project.name}:`,
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

  // Creation
  if (!ctx.subject) {
    return {
      steps: [
        ...start,
        {
          ...step("list_subjects", {}, "", 80),
          result_summary: null,
          error: "O projeto não tem assuntos cadastrados",
        },
      ],
      statusFinal: "error",
      response: null,
      draft: null,
    };
  }

  const networks: Network[] = ctx.request.toLowerCase().includes("instagram")
    ? ["instagram", "linkedin"]
    : ["linkedin", "x"];
  const doc = ctx.documents[0];
  const title = summarize(ctx.request) || "Post criado pelo agente";

  const steps: ScriptStep[] = [
    ...start,
    step(
      "get_subject",
      { id: ctx.subject.id },
      `${ctx.subject.name} · voz do projeto`,
      90,
    ),
    step(
      "search_documents",
      { query: query },
      doc
        ? `4 trechos relevantes de ${doc}`
        : "Nenhum documento pronto no projeto; seguindo sem RAG",
      380,
    ),
    step(
      "search_past_posts",
      { subject: ctx.subject.name },
      "3 posts aprovados como referência de estilo",
      140,
    ),
    // The LLM asks to adapt for every network at once (same iteration)
    ...networks.map((network, i) => ({
      ...step(
        "adapt_for_network",
        { network },
        network === "x" ? "264 caracteres (limite 280)" : "1.180 caracteres",
        60,
      ),
      parallel: i > 0,
    })),
    withError
      ? {
          ...step("generate_image", { format: "1:1" }, "", 4100),
          result_summary: null,
          error: "O provedor de imagem recusou o prompt",
        }
      : step(
          "generate_image",
          { format: "1:1", prompt: `ilustração sobre ${query}, sem texto` },
          "Imagem 1080×1080 salva",
          4100,
        ),
  ];
  if (withError)
    return { steps, statusFinal: "error", response: null, draft: null };

  steps.push(step("save_draft", { title }, "Post salvo como rascunho", 70));

  return {
    steps,
    statusFinal: "completed",
    draft: {
      title: title,
      subject_id: ctx.subject.id,
      networks,
      text: `${title}.\n\nTexto gerado pelo agente${doc ? ` com base em ${doc}` : ""}, no tom "${ctx.project.voice_tone ?? "padrão"}".`,
    },
    response: [
      `Pronto! Escrevi o post "${title}" para ${networks.map((r) => (r === "x" ? "X" : r === "linkedin" ? "LinkedIn" : "Instagram")).join(" e ")}.`,
      doc
        ? `Usei trechos de ${doc} e o estilo de 3 posts aprovados.`
        : "Não havia documentos prontos, então usei só o estilo dos posts aprovados.",
      "Salvei como rascunho: revise o texto e a imagem antes de aprovar.",
    ].join("\n"),
  };
}

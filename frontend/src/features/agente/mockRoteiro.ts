// ROTEIROS do agente fictício (só para `npm run dev` sem backend).
// Gera, sem efeitos colaterais, os passos que o agente "executaria" para um pedido.
// Palavras no pedido forçam cenários de teste: "#erro" (falha numa tool) e
// "#limite" (atinge o limite de iterações).
import type { ModoAgente, Rede, StatusExecucao } from "@/lib/dominio";
import { MAX_ITERACOES, type PassoAgente } from "./types";

export type PassoRoteiro = Omit<PassoAgente, "id" | "ordem"> & {
  /** Chamada em paralelo com a anterior, na mesma iteração do loop */
  paralelo?: boolean;
};

export type Roteiro = {
  passos: PassoRoteiro[];
  statusFinal: Exclude<StatusExecucao, "running">;
  resposta: string | null;
  /** Em criação: dados do rascunho que o agente salva no final */
  rascunho: { title: string; subject_id: string; redes: Rede[]; texto: string } | null;
};

export type ContextoRoteiro = {
  modo: ModoAgente;
  pedido: string;
  projeto: { name: string; voice_tone: string | null; target_audience: string | null };
  assunto: { id: string; name: string } | null;
  documentos: string[];
};

const passo = (
  tool: string,
  argumentos: Record<string, unknown>,
  resultado_resumo: string,
  duracao_ms: number,
): PassoRoteiro => ({ tool, argumentos, resultado_resumo, duracao_ms, erro: null });

function resumir(pedido: string, max = 60) {
  const limpo = pedido.replace(/#\w+/g, "").trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

export function criarRoteiro(ctx: ContextoRoteiro): Roteiro {
  const consulta = resumir(ctx.pedido, 40);
  const comErro = ctx.pedido.includes("#erro");
  const noLimite = ctx.pedido.includes("#limite");

  const inicio: PassoRoteiro[] = [
    passo(
      "obter_projeto",
      {},
      `${ctx.projeto.name} · tom: ${ctx.projeto.voice_tone ?? "não definido"}`,
      110,
    ),
  ];

  // Cenário: o agente não termina dentro do limite de iterações
  if (noLimite) {
    const passos = [...inicio];
    for (let i = passos.length; i < MAX_ITERACOES; i++) {
      passos.push(
        passo("pesquisar_web", { query: `${consulta} (${i})` }, "5 resultados, nenhum conclusivo", 900),
      );
    }
    return {
      passos,
      statusFinal: "limit_reached",
      resposta: null,
      rascunho: null,
    };
  }

  if (ctx.modo === "ideation") {
    const passos: PassoRoteiro[] = [
      ...inicio,
      passo(
        "analisar_desempenho",
        {},
        "Melhor taxa: LinkedIn às terças de manhã (6,6%). Assuntos com menos de 5 posts sem conclusão.",
        420,
      ),
      passo(
        "buscar_posts_anteriores",
        { assunto: ctx.assunto?.name ?? "todos" },
        "3 posts aprovados como referência de estilo",
        150,
      ),
      comErro
        ? { ...passo("pesquisar_web", { query: consulta }, "", 1800), resultado_resumo: null, erro: "Tempo esgotado ao consultar o serviço de busca" }
        : passo("pesquisar_web", { query: consulta }, "6 fontes: blogs do setor, notícias da semana e um relatório de mercado", 1300),
    ];
    if (comErro) return { passos, statusFinal: "error", resposta: null, rascunho: null };
    return {
      passos,
      statusFinal: "completed",
      rascunho: null,
      resposta: [
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
      passos: [
        ...inicio,
        { ...passo("listar_assuntos", {}, "", 80), resultado_resumo: null, erro: "O projeto não tem assuntos cadastrados" },
      ],
      statusFinal: "error",
      resposta: null,
      rascunho: null,
    };
  }

  const redes: Rede[] = ctx.pedido.toLowerCase().includes("instagram")
    ? ["instagram", "linkedin"]
    : ["linkedin", "x"];
  const doc = ctx.documentos[0];
  const titulo = resumir(ctx.pedido) || "Post criado pelo agente";

  const passos: PassoRoteiro[] = [
    ...inicio,
    passo("obter_assunto", { id: ctx.assunto.id }, `${ctx.assunto.name} · voz do projeto`, 90),
    passo(
      "buscar_documentos",
      { query: consulta },
      doc ? `4 trechos relevantes de ${doc}` : "Nenhum documento pronto no projeto; seguindo sem RAG",
      380,
    ),
    passo("buscar_posts_anteriores", { assunto: ctx.assunto.name }, "3 posts aprovados como referência de estilo", 140),
    // O LLM pede a adaptação para todas as redes de uma vez (mesma iteração)
    ...redes.map((rede, i) => ({
      ...passo("adaptar_para_rede", { rede }, rede === "x" ? "264 caracteres (limite 280)" : "1.180 caracteres", 60),
      paralelo: i > 0,
    })),
    comErro
      ? { ...passo("gerar_imagem", { formato: "1:1" }, "", 4100), resultado_resumo: null, erro: "O provedor de imagem recusou o prompt" }
      : passo("gerar_imagem", { formato: "1:1", prompt: `ilustração sobre ${consulta}, sem texto` }, "Imagem 1080×1080 salva", 4100),
  ];
  if (comErro) return { passos, statusFinal: "error", resposta: null, rascunho: null };

  passos.push(passo("salvar_rascunho", { titulo }, "Post salvo como rascunho", 70));

  return {
    passos,
    statusFinal: "completed",
    rascunho: {
      title: titulo,
      subject_id: ctx.assunto.id,
      redes,
      texto: `${titulo}.\n\nTexto gerado pelo agente${doc ? ` com base em ${doc}` : ""}, no tom "${ctx.projeto.voice_tone ?? "padrão"}".`,
    },
    resposta: [
      `Pronto! Escrevi o post "${titulo}" para ${redes.map((r) => (r === "x" ? "X" : r === "linkedin" ? "LinkedIn" : "Instagram")).join(" e ")}.`,
      doc ? `Usei trechos de ${doc} e o estilo de 3 posts aprovados.` : "Não havia documentos prontos, então usei só o estilo dos posts aprovados.",
      "Salvei como rascunho: revise o texto e a imagem antes de aprovar.",
    ].join("\n"),
  };
}

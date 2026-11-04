// AGENTE FICTÍCIO (ver lib/api/mockDb.ts e ./mockRoteiro.ts).
// Os passos do roteiro "aparecem" um a um conforme o tempo passa, imitando
// o backend que roda o agente em segundo plano e grava cada PassoAgente.
import { imagemFicticia } from "@/features/imagens/ficticia";
import {
  agoraIso,
  latencia,
  mockDb,
  type ExecucaoMock,
} from "@/lib/api/mockDb";
import { criarRoteiro } from "./mockRoteiro";
import type { AgenteService } from "./service";
import type { ExecucaoAgente } from "./types";

/** Tempo entre um passo e outro na tela (mais curto que as durações "reais"). */
const INTERVALO_MS = 900;

/** Cria o rascunho do post quando a execução de criação termina. */
function finalizar(exec: ExecucaoMock): ExecucaoMock {
  let postId = exec.post_id;
  const rascunho = exec.roteiro.rascunho;
  if (rascunho && !postId) {
    const agora = agoraIso();
    postId = crypto.randomUUID();
    // A imagem gerada pelo agente entra na biblioteca do projeto e no rascunho
    const prompt = exec.roteiro.passos.find((p) => p.tool === "gerar_imagem")
      ?.argumentos.prompt;
    const imagemId = crypto.randomUUID();
    mockDb.imagens.inserir({
      id: imagemId,
      project_id: exec.project_id,
      content_type: "image/svg+xml",
      description: typeof prompt === "string" ? prompt : null,
      url: imagemFicticia(imagemId),
      created_at: agora,
      updated_at: agora,
    });
    mockDb.posts.inserir({
      id: postId,
      subject_id: rascunho.subject_id,
      title: rascunho.title,
      content: rascunho.texto,
      status: "draft", // o agente só salva rascunhos
      expected_date: null,
      // O agente escreve para a primeira rede pedida, com a imagem gerada
      network: rascunho.redes[0] ?? "linkedin",
      format: "single",
      image_ids: [imagemId],
      created_at: agora,
      updated_at: agora,
    });
  }
  return mockDb.execucoes.substituir({
    ...exec,
    post_id: postId,
    finalizada: true,
  });
}

/** Monta a resposta da API a partir do tempo decorrido desde o início. */
function materializar(registro: ExecucaoMock): ExecucaoAgente {
  const total = registro.roteiro.passos.length;
  const decorrido = Date.now() - new Date(registro.iniciada_em).getTime();

  let exec = registro;
  if (!exec.finalizada && decorrido >= total * INTERVALO_MS + 400) {
    exec = finalizar(exec);
  }

  const visiveis = exec.finalizada
    ? total
    : Math.min(total, Math.floor(decorrido / INTERVALO_MS));

  const duracaoTotal = exec.roteiro.passos.reduce(
    (soma, p) => soma + (p.duracao_ms ?? 0),
    0,
  );

  // Chamadas em paralelo (ex.: adaptar para LinkedIn e para X) contam como uma iteração
  const passosVistos = exec.roteiro.passos.slice(0, visiveis);
  const iteracoes = passosVistos.filter((p) => !p.paralelo).length;

  return {
    id: exec.id,
    project_id: exec.project_id,
    modo: exec.modo,
    pedido: exec.pedido,
    status: exec.finalizada ? exec.roteiro.statusFinal : "running",
    resposta: exec.finalizada ? exec.roteiro.resposta : null,
    post_id: exec.finalizada ? exec.post_id : null,
    iteracoes,
    passos: passosVistos.map((p, i) => ({
      tool: p.tool,
      argumentos: p.argumentos,
      resultado_resumo: p.resultado_resumo,
      duracao_ms: p.duracao_ms,
      erro: p.erro,
      id: `${exec.id}-passo-${i + 1}`,
      ordem: i + 1,
    })),
    iniciada_em: exec.iniciada_em,
    finalizada_em: exec.finalizada
      ? new Date(
          new Date(exec.iniciada_em).getTime() + duracaoTotal,
        ).toISOString()
      : null,
  };
}

export const agenteMock: AgenteService = {
  async executar({ project_id, modo, pedido }) {
    await latencia();
    const projeto = mockDb.projetos.encontrar(project_id, "Projeto");
    const assuntos = mockDb.assuntos
      .todos()
      .filter((a) => a.project_id === project_id);
    // Usa o assunto citado no pedido; senão, o primeiro do projeto
    const assunto =
      assuntos.find((a) =>
        pedido.toLowerCase().includes(a.name.toLowerCase()),
      ) ??
      assuntos[0] ??
      null;
    const documentos = mockDb.documentos
      .todos()
      .filter((d) => d.project_id === project_id && d.status === "ready")
      .map((d) => d.name);

    const registro = mockDb.execucoes.inserir({
      id: crypto.randomUUID(),
      project_id,
      modo,
      pedido,
      iniciada_em: agoraIso(),
      roteiro: criarRoteiro({
        modo,
        pedido,
        projeto,
        assunto: assunto && { id: assunto.id, name: assunto.name },
        documentos,
      }),
      post_id: null,
      finalizada: false,
    });
    return materializar(registro);
  },

  async listar(projetoId) {
    await latencia();
    return mockDb.execucoes
      .todos()
      .filter((e) => e.project_id === projetoId)
      .map(materializar)
      .sort((a, b) => b.iniciada_em.localeCompare(a.iniciada_em));
  },

  async obter(id) {
    await latencia();
    return materializar(mockDb.execucoes.encontrar(id, "Execução"));
  },
};

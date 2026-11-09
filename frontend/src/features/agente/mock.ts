// AGENTE FICTÍCIO (ver lib/api/mockDb.ts e ./mockRoteiro.ts).
// Os passos do roteiro "aparecem" um a um conforme o tempo passa, imitando
// o backend que roda o agente em segundo plano e grava cada AgentStep.
import { imagemFicticia } from "@/features/imagens/ficticia";
import {
  agoraIso,
  latencia,
  mockDb,
  type ExecucaoMock,
} from "@/lib/api/mockDb";
import { criarRoteiro } from "./mockRoteiro";
import type { AgenteService } from "./service";
import type { AgentRun } from "./types";

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
    const prompt = exec.roteiro.steps.find((p) => p.tool === "generate_image")
      ?.arguments.prompt;
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
      // One variation per requested network, with the generated image.
      // The agent only saves drafts.
      variations: (rascunho.redes.length
        ? rascunho.redes
        : (["linkedin"] as const)
      ).map((network) => ({
        id: crypto.randomUUID(),
        network,
        format: "single",
        content: rascunho.texto,
        status: "draft",
        expected_date: null,
        image_ids: [imagemId],
      })),
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

/** Monta a response da API a partir do tempo decorrido desde o início. */
function materializar(registro: ExecucaoMock): AgentRun {
  const total = registro.roteiro.steps.length;
  const decorrido = Date.now() - new Date(registro.started_at).getTime();

  let exec = registro;
  if (!exec.finalizada && decorrido >= total * INTERVALO_MS + 400) {
    exec = finalizar(exec);
  }

  const visiveis = exec.finalizada
    ? total
    : Math.min(total, Math.floor(decorrido / INTERVALO_MS));

  const duracaoTotal = exec.roteiro.steps.reduce(
    (soma, p) => soma + (p.duration_ms ?? 0),
    0,
  );

  // Chamadas em paralelo (ex.: adaptar para LinkedIn e para X) contam como uma iteração
  const passosVistos = exec.roteiro.steps.slice(0, visiveis);
  const iterations = passosVistos.filter((p) => !p.paralelo).length;

  return {
    id: exec.id,
    project_id: exec.project_id,
    mode: exec.mode,
    request: exec.request,
    status: exec.finalizada ? exec.roteiro.statusFinal : "running",
    response: exec.finalizada ? exec.roteiro.response : null,
    post_id: exec.finalizada ? exec.post_id : null,
    iterations,
    steps: passosVistos.map((p, i) => ({
      tool: p.tool,
      arguments: p.arguments,
      result_summary: p.result_summary,
      duration_ms: p.duration_ms,
      error: p.error,
      id: `${exec.id}-passo-${i + 1}`,
      step_number: i + 1,
    })),
    started_at: exec.started_at,
    finished_at: exec.finalizada
      ? new Date(
          new Date(exec.started_at).getTime() + duracaoTotal,
        ).toISOString()
      : null,
  };
}

export const agenteMock: AgenteService = {
  async executar({ project_id, mode, request }) {
    await latencia();
    const projeto = mockDb.projetos.encontrar(project_id, "Projeto");
    const assuntos = mockDb.assuntos
      .todos()
      .filter((a) => a.project_id === project_id);
    // Usa o assunto citado no pedido; senão, o primeiro do projeto
    const assunto =
      assuntos.find((a) =>
        request.toLowerCase().includes(a.name.toLowerCase()),
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
      mode,
      request,
      started_at: agoraIso(),
      roteiro: criarRoteiro({
        mode,
        request,
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
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
  },

  async obter(id) {
    await latencia();
    return materializar(mockDb.execucoes.encontrar(id, "Execução"));
  },
};

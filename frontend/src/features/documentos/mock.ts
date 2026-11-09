// API FICTÍCIA de documentos (ver lib/api/mockDb.ts). Não guarda o arquivo:
// só simula o envio e o processamento (pendente → processando → pronto/error).
// Arquivos vazios ou com "error" no nome terminam com status "error".
import { ApiError } from "@/lib/api/http";
import { agoraIso, latencia, mockDb, type DocumentoMock } from "@/lib/api/mockDb";
import type { DocumentosService } from "./service";
import type { ProjectDocument } from "./types";
import { TAMANHO_MAXIMO, tipoDoArquivo } from "./validacao";

const TEMPO_PROCESSAMENTO_MS = 3500;

/** Avança o status conforme o tempo passa, como o backend faria em segundo plano. */
function atualizar(doc: DocumentoMock): DocumentoMock {
  if (doc.status !== "processing" || !doc.processamento_iniciado_em) return doc;
  const decorrido = Date.now() - new Date(doc.processamento_iniciado_em).getTime();
  if (decorrido < TEMPO_PROCESSAMENTO_MS) return doc;

  const falhou = doc.size_bytes === 0 || doc.name.toLowerCase().includes("error");
  return mockDb.documentos.substituir({
    ...doc,
    status: falhou ? "error" : "ready",
    error_message: falhou ? "Não foi possível extrair texto do arquivo" : null,
    chunk_count: falhou ? null : Math.max(1, Math.round(doc.size_bytes / 30_000)),
    updated_at: agoraIso(),
  });
}

const publico = ({ processamento_iniciado_em: _ignorado, ...doc }: DocumentoMock): ProjectDocument => {
  void _ignorado;
  return doc;
};

export const documentosMock: DocumentosService = {
  async listar(projetoId) {
    await latencia();
    mockDb.projetos.encontrar(projetoId, "Projeto");
    return mockDb.documentos
      .todos()
      .filter((d) => d.project_id === projetoId)
      .map(atualizar)
      .map(publico)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async enviar(projetoId, arquivo, onProgress) {
    mockDb.projetos.encontrar(projetoId, "Projeto");
    const type = tipoDoArquivo(arquivo.name);
    if (!type) throw new ApiError(422, "Tipo de arquivo não aceito");
    if (arquivo.size > TAMANHO_MAXIMO) throw new ApiError(422, "Arquivo maior que o permitido");

    // Simula o PUT no S3 com progresso
    for (const fracao of [0.15, 0.4, 0.7, 1]) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      onProgress?.(fracao);
    }

    const agora = agoraIso();
    const doc = mockDb.documentos.inserir({
      id: crypto.randomUUID(),
      project_id: projetoId,
      name: arquivo.name,
      type,
      size_bytes: arquivo.size,
      status: "processing",
      error_message: null,
      chunk_count: null,
      created_at: agora,
      updated_at: agora,
      processamento_iniciado_em: agora,
    });
    return publico(doc);
  },

  async excluir(id) {
    await latencia();
    mockDb.documentos.encontrar(id, "ProjectDocument");
    mockDb.documentos.remover(id);
  },
};

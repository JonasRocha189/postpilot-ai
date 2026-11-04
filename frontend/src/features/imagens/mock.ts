// API FICTÍCIA de imagens (ver lib/api/mockDb.ts). A "URL" é um data URL
// de uma cópia reduzida da imagem, para caber no localStorage.
import { ApiError } from "@/lib/api/http";
import { agoraIso, latencia, mockDb } from "@/lib/api/mockDb";
import { TAMANHO_MAXIMO, tipoDaImagem } from "./arquivo";
import type { ImagensService } from "./service";

const LADO_MAXIMO = 640;

/** Reduz a imagem e devolve um data URL JPEG. */
async function reduzir(arquivo: File) {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(
    1,
    LADO_MAXIMO / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

export const imagensMock: ImagensService = {
  async listar(projetoId) {
    await latencia();
    mockDb.projetos.encontrar(projetoId, "Projeto");
    return mockDb.imagens
      .todos()
      .filter((i) => i.project_id === projetoId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async enviar(projetoId, arquivo, onProgress) {
    mockDb.projetos.encontrar(projetoId, "Projeto");
    if (!tipoDaImagem(arquivo))
      throw new ApiError(422, "Unsupported image type");
    if (arquivo.size > TAMANHO_MAXIMO)
      throw new ApiError(422, "Image is too large");

    // Simula o PUT no S3 com progresso
    for (const fracao of [0.2, 0.5, 0.8, 1]) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      onProgress?.(fracao);
    }

    const agora = agoraIso();
    return mockDb.imagens.inserir({
      id: crypto.randomUUID(),
      project_id: projetoId,
      content_type: arquivo.type,
      description: null,
      url: await reduzir(arquivo),
      created_at: agora,
      updated_at: agora,
    });
  },

  async excluir(id) {
    await latencia();
    mockDb.imagens.encontrar(id, "Imagem");
    // Regra da API: não exclui imagem usada por algum post
    if (mockDb.posts.todos().some((p) => p.image_id === id)) {
      throw new ApiError(409, "Image is used by posts");
    }
    mockDb.imagens.remover(id);
  },
};

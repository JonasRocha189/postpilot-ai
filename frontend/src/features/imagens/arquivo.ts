import type { FormatoImagem } from "@/lib/dominio";
import type { TipoImagem } from "./types";

/** Tamanho máximo por imagem. O backend valida de novo ao gerar a URL de upload. */
export const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

export const MIME_POR_TIPO: Record<TipoImagem, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Formato aceito pelo react-dropzone. */
export const ACCEPT = {
  [MIME_POR_TIPO.png]: [".png"],
  [MIME_POR_TIPO.jpeg]: [".jpg", ".jpeg"],
  [MIME_POR_TIPO.webp]: [".webp"],
};

export function tipoDaImagem(arquivo: File): TipoImagem | null {
  const tipo = (Object.keys(MIME_POR_TIPO) as TipoImagem[]).find(
    (t) => MIME_POR_TIPO[t] === arquivo.type,
  );
  return tipo ?? null;
}

const PROPORCAO: Record<FormatoImagem, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
};

/** Formato mais próximo das dimensões da imagem (ex.: 1080×1350 → 4:5). */
export function formatoMaisProximo(
  largura: number,
  altura: number,
): FormatoImagem {
  const razao = largura / altura;
  return (Object.keys(PROPORCAO) as FormatoImagem[]).reduce((melhor, f) =>
    Math.abs(PROPORCAO[f] - razao) < Math.abs(PROPORCAO[melhor] - razao)
      ? f
      : melhor,
  );
}

/** Classe do Tailwind com a proporção do formato, para a miniatura. */
export const ASPECTO: Record<FormatoImagem, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "16:9": "aspect-video",
};

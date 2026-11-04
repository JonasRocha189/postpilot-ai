// Cálculos da arte do post (sem DOM): tamanhos por rede, quebra de linhas,
// ajuste do texto e recorte da imagem de fundo. O desenho fica em canvas.ts.
import type { Rede } from "@/lib/dominio";

export type TamanhoArte = {
  largura: number;
  altura: number;
  /** Rótulo da proporção (ex.: "4:5") */
  proporcao: string;
};

/** Tamanhos recomendados de imagem única por rede (o primeiro é o padrão). */
export const TAMANHOS_ARTE: Record<Rede, readonly TamanhoArte[]> = {
  instagram: [
    { largura: 1080, altura: 1350, proporcao: "4:5" },
    { largura: 1080, altura: 1080, proporcao: "1:1" },
  ],
  linkedin: [
    { largura: 1200, altura: 1200, proporcao: "1:1" },
    { largura: 1080, altura: 1350, proporcao: "4:5" },
    { largura: 1200, altura: 627, proporcao: "1.91:1" },
  ],
  x: [
    { largura: 1600, altura: 900, proporcao: "16:9" },
    { largura: 1080, altura: 1080, proporcao: "1:1" },
  ],
};

export type PosicaoTexto = "top" | "middle" | "bottom";
export type AlinhamentoTexto = "left" | "center" | "right";

export type FundoImagem = {
  /** 1 = cobre a arte inteira; acima disso, aproxima */
  zoom: number;
  /** Parte visível quando a imagem sobra: 0 = início, 0,5 = centro, 1 = fim */
  focoX: number;
  focoY: number;
  /** Camada escura sobre a imagem (0 a 1), para o texto ficar legível */
  escurecer: number;
};

export type Arte = {
  largura: number;
  altura: number;
  /** Cor de fundo (aparece quando não há imagem) */
  cor: string;
  /** Ajustes da imagem de fundo; null = fundo só com a cor */
  imagem: FundoImagem | null;
  texto: string;
  corTexto: string;
  /** Tamanho da fonte numa arte de 1080 px de largura (escala com a arte) */
  fonte: number;
  alinhamento: AlinhamentoTexto;
  posicao: PosicaoTexto;
};

/** Família da fonte da arte (a mesma da interface, carregada do Google Fonts). */
export const FONTE_ARTE = "Outfit";
export const PESO_FONTE = 600;
export const ALTURA_LINHA = 1.2;
/** Menor fonte legível no celular (numa arte de 1080 px), ver Boas práticas. */
export const FONTE_MINIMA = 24;
/** Margem interna, em fração da menor dimensão da arte. */
const MARGEM = 0.08;

/** Fonte em pixels da arte (a fonte é pensada para 1080 px de largura). */
export const escalaFonte = (arte: Pick<Arte, "largura">, fonte: number) =>
  Math.round((fonte * arte.largura) / 1080);

export const fonteCss = (px: number) =>
  `${PESO_FONTE} ${px}px ${FONTE_ARTE}, sans-serif`;

export const margem = (arte: Pick<Arte, "largura" | "altura">) =>
  Math.round(Math.min(arte.largura, arte.altura) * MARGEM);

type Medir = (texto: string) => number;

/**
 * Quebra o texto em linhas que cabem em `larguraMaxima`. Respeita as quebras
 * de linha do usuário; palavras maiores que a linha são cortadas.
 */
export function quebrarLinhas(
  texto: string,
  larguraMaxima: number,
  medir: Medir,
): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let linha = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (medir(tentativa) <= larguraMaxima) {
        linha = tentativa;
        continue;
      }
      if (linha) linhas.push(linha);
      // Palavra sozinha maior que a linha: corta por caractere
      linha = "";
      for (const caractere of Array.from(palavra)) {
        if (linha && medir(linha + caractere) > larguraMaxima) {
          linhas.push(linha);
          linha = caractere;
        } else {
          linha += caractere;
        }
      }
    }
    linhas.push(linha);
  }
  // Tira linhas vazias do começo e do fim (mantém as do meio)
  while (linhas.length && !linhas[0].trim()) linhas.shift();
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  return linhas;
}

/**
 * Quebra o texto e diminui a fonte até caber na caixa (sem passar da fonte
 * mínima). `medir(texto, px)` devolve a largura do texto com a fonte em px.
 */
export function ajustarTexto(
  texto: string,
  caixa: { largura: number; altura: number },
  fonte: number,
  fonteMinima: number,
  medir: (texto: string, px: number) => number,
): { fonte: number; linhas: string[] } {
  let px = Math.max(fonte, fonteMinima);
  for (;;) {
    const linhas = quebrarLinhas(texto, caixa.largura, (t) => medir(t, px));
    const altura = linhas.length * px * ALTURA_LINHA;
    if (altura <= caixa.altura || px <= fonteMinima) {
      return { fonte: px, linhas };
    }
    px = Math.max(fonteMinima, px - Math.max(2, Math.round(px * 0.05)));
  }
}

/**
 * Recorte da imagem para cobrir a arte inteira sem distorcer (como o
 * object-fit: cover do CSS), com zoom e o ponto que fica visível.
 */
export function recorteCover(
  imagem: { largura: number; altura: number },
  arte: { largura: number; altura: number },
  ajuste: Pick<FundoImagem, "zoom" | "focoX" | "focoY">,
) {
  const escala =
    Math.max(arte.largura / imagem.largura, arte.altura / imagem.altura) *
    Math.max(1, ajuste.zoom);
  const sw = arte.largura / escala;
  const sh = arte.altura / escala;
  const limitar = (v: number) => Math.min(1, Math.max(0, v));
  return {
    sx: (imagem.largura - sw) * limitar(ajuste.focoX),
    sy: (imagem.altura - sh) * limitar(ajuste.focoY),
    sw,
    sh,
  };
}

/**
 * Quanto a imagem, já ampliada para cobrir a arte, sobra além dela (em
 * pixels da arte). Serve para converter o arraste em mudança de foco.
 */
export function sobraCover(
  imagem: { largura: number; altura: number },
  arte: { largura: number; altura: number },
  zoom: number,
) {
  const escala =
    Math.max(arte.largura / imagem.largura, arte.altura / imagem.altura) *
    Math.max(1, zoom);
  return {
    x: imagem.largura * escala - arte.largura,
    y: imagem.altura * escala - arte.altura,
  };
}

/** Posição (topo) do bloco de texto conforme a posição escolhida. */
export function topoDoTexto(
  posicao: PosicaoTexto,
  alturaArte: number,
  alturaTexto: number,
  margemInterna: number,
) {
  if (posicao === "top") return margemInterna;
  if (posicao === "bottom") return alturaArte - margemInterna - alturaTexto;
  return (alturaArte - alturaTexto) / 2;
}

/** Luminância relativa de uma cor #rrggbb (0 = preto, 1 = branco). */
export function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cor de texto que contrasta com o fundo (branco ou quase preto). */
export const corQueContrasta = (fundo: string) =>
  luminancia(fundo) > 0.4 ? "#101828" : "#FFFFFF";

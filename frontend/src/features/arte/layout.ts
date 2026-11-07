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
  /**
   * 1 = covers the whole artwork; above 1 it zooms in; below 1 it gets smaller
   * and the background color shows around it
   */
  zoom: number;
  /** Center of the image, as a fraction of the artwork (0.5 = centered). Dragged freely, like the text */
  x: number;
  y: number;
  /** Camada escura sobre a imagem (0 a 1), para o texto ficar legível */
  escurecer: number;
};

/** Centro do bloco de texto arrastado, em fração da arte (0 a 1). */
export type PontoTexto = { x: number; y: number };

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
  /** Posição livre (texto arrastado); null = usa `posicao` e `alinhamento` */
  ponto: PontoTexto | null;
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

/** Zoom range of the background image (1 = covers the artwork). */
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 3;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Image center limited to the artwork, so part of the image always shows. */
export const clampCenter = (v: number) => clamp(v, 0, 1);

/** Where the background image is drawn, in artwork pixels (may go past the edges). */
export type ImageArea = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Rectangle of the background image, without distortion. At zoom 1 it covers
 * the artwork like CSS `object-fit: cover`; the center (x, y) moves it freely.
 */
export function imageArea(
  image: { largura: number; altura: number },
  artwork: { largura: number; altura: number },
  adjust: Pick<FundoImagem, "zoom" | "x" | "y">,
): ImageArea {
  const scale =
    Math.max(artwork.largura / image.largura, artwork.altura / image.altura) *
    clamp(adjust.zoom, ZOOM_MIN, ZOOM_MAX);
  const width = image.largura * scale;
  const height = image.altura * scale;
  return {
    left: clampCenter(adjust.x) * artwork.largura - width / 2,
    top: clampCenter(adjust.y) * artwork.altura - height / 2,
    width,
    height,
  };
}

/** Does the image cover the whole artwork (no background color showing)? */
export function coversArtwork(
  area: ImageArea,
  artwork: { largura: number; altura: number },
) {
  // Tolerance for rounding in the scale
  const e = 0.5;
  return (
    area.left <= e &&
    area.top <= e &&
    area.left + area.width >= artwork.largura - e &&
    area.top + area.height >= artwork.altura - e
  );
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

/** Bloco de texto na arte (pixels): retângulo e o x onde as linhas se alinham. */
export type CaixaTexto = {
  esquerda: number;
  topo: number;
  largura: number;
  altura: number;
  /** x passado ao fillText (início, centro ou fim do bloco, conforme o alinhamento) */
  ancoraX: number;
};

type Dimensoes = { largura: number; altura: number };

/** Centro do bloco limitado para o bloco inteiro ficar dentro das margens. */
function centroLimitado(
  fracao: number,
  total: number,
  tamanho: number,
  margemInterna: number,
) {
  const minimo = margemInterna + tamanho / 2;
  const maximo = total - margemInterna - tamanho / 2;
  // Bloco maior que a área útil: fica centralizado
  if (minimo > maximo) return total / 2;
  return Math.min(maximo, Math.max(minimo, fracao * total));
}

/**
 * Ponto livre ajustado para o bloco (do tamanho `bloco`) não passar das
 * margens. Usado ao arrastar, para o texto "parar" na borda em vez de o
 * ponto continuar andando além dela.
 */
export function limitarPonto(
  ponto: PontoTexto,
  arte: Dimensoes,
  bloco: Dimensoes,
  margemInterna: number,
): PontoTexto {
  return {
    x:
      centroLimitado(ponto.x, arte.largura, bloco.largura, margemInterna) /
      arte.largura,
    y:
      centroLimitado(ponto.y, arte.altura, bloco.altura, margemInterna) /
      arte.altura,
  };
}

/**
 * Onde fica o bloco de texto (`bloco` = largura da linha mais larga e altura
 * de todas as linhas). Com `ponto`, o bloco é centralizado nele (sem passar
 * das margens); sem, segue a posição fixa (topo, meio, base) e o alinhamento.
 */
export function caixaDoTexto(
  arte: Pick<Arte, "largura" | "altura" | "alinhamento" | "posicao" | "ponto">,
  bloco: Dimensoes,
  margemInterna: number,
): CaixaTexto {
  let esquerda: number;
  let topo: number;
  if (arte.ponto) {
    const p = limitarPonto(arte.ponto, arte, bloco, margemInterna);
    esquerda = p.x * arte.largura - bloco.largura / 2;
    topo = p.y * arte.altura - bloco.altura / 2;
  } else {
    esquerda =
      arte.alinhamento === "left"
        ? margemInterna
        : arte.alinhamento === "right"
          ? arte.largura - margemInterna - bloco.largura
          : (arte.largura - bloco.largura) / 2;
    topo = topoDoTexto(arte.posicao, arte.altura, bloco.altura, margemInterna);
  }
  const ancoraX =
    arte.alinhamento === "left"
      ? esquerda
      : arte.alinhamento === "right"
        ? esquerda + bloco.largura
        : esquerda + bloco.largura / 2;
  return { esquerda, topo, ...bloco, ancoraX };
}

/** O ponto (pixels da arte) está sobre o bloco, com uma folga em volta? */
export function dentroDaCaixa(
  caixa: CaixaTexto,
  x: number,
  y: number,
  folga = 0,
) {
  return (
    x >= caixa.esquerda - folga &&
    x <= caixa.esquerda + caixa.largura + folga &&
    y >= caixa.topo - folga &&
    y <= caixa.topo + caixa.altura + folga
  );
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

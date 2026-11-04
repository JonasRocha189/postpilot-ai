// Desenho da arte no <canvas>, exportação e carga da imagem de fundo.
// Fica separado de layout.ts porque depende do navegador (nos testes de
// integração o jsdom não tem canvas e este módulo é substituído).
import { TAMANHO_MAXIMO } from "@/features/imagens/arquivo";
import {
  ajustarTexto,
  ALTURA_LINHA,
  escalaFonte,
  FONTE_ARTE,
  FONTE_MINIMA,
  fonteCss,
  margem,
  PESO_FONTE,
  recorteCover,
  topoDoTexto,
  type Arte,
} from "./layout";

/** Imagem de fundo já decodificada. */
export type ImagemFundo = ImageBitmap;

/**
 * Desenha a arte no canvas. O canvas tem o tamanho da arte multiplicado por
 * `escala` (1 na prévia e na exportação; menor nas miniaturas dos slides).
 */
export function desenharArte(
  canvas: HTMLCanvasElement,
  arte: Arte,
  fundo: ImagemFundo | null,
  escala = 1,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  const { largura, altura } = arte;
  ctx.clearRect(0, 0, largura, altura);

  ctx.fillStyle = arte.cor;
  ctx.fillRect(0, 0, largura, altura);

  if (arte.imagem && fundo) {
    const r = recorteCover(
      { largura: fundo.width, altura: fundo.height },
      arte,
      arte.imagem,
    );
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(fundo, r.sx, r.sy, r.sw, r.sh, 0, 0, largura, altura);
    if (arte.imagem.escurecer > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${arte.imagem.escurecer})`;
      ctx.fillRect(0, 0, largura, altura);
    }
  }

  const texto = arte.texto.trim();
  if (!texto) return;

  const m = margem(arte);
  const caixa = { largura: largura - 2 * m, altura: altura - 2 * m };
  const { fonte, linhas } = ajustarTexto(
    texto,
    caixa,
    escalaFonte(arte, arte.fonte),
    escalaFonte(arte, FONTE_MINIMA),
    (t, px) => {
      ctx.font = fonteCss(px);
      return ctx.measureText(t).width;
    },
  );
  const alturaLinha = fonte * ALTURA_LINHA;
  const topo = topoDoTexto(
    arte.posicao,
    altura,
    linhas.length * alturaLinha,
    m,
  );
  const x =
    arte.alinhamento === "left"
      ? m
      : arte.alinhamento === "right"
        ? largura - m
        : largura / 2;

  ctx.font = fonteCss(fonte);
  ctx.fillStyle = arte.corTexto;
  ctx.textAlign = arte.alinhamento;
  ctx.textBaseline = "middle";
  // Sombra leve só sobre foto, para destacar o texto
  if (arte.imagem && fundo) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = Math.round(fonte * 0.15);
  }
  linhas.forEach((linha, i) => {
    ctx.fillText(linha, x, topo + alturaLinha * (i + 0.5));
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

/** Espera a fonte da arte carregar (senão o canvas usa a fonte reserva). */
export async function carregarFonte() {
  try {
    await document.fonts.load(`${PESO_FONTE} 64px ${FONTE_ARTE}`);
  } catch {
    // Sem a fonte, a arte sai com a fonte reserva (sans-serif)
  }
}

/**
 * Baixa a imagem da biblioteca e decodifica. Usa fetch sem cache: uma cópia
 * em cache sem os cabeçalhos CORS "sujaria" o canvas e impediria exportar.
 */
export async function carregarImagem(url: string): Promise<ImagemFundo> {
  const resposta = await fetch(url, { cache: "no-store", mode: "cors" });
  if (!resposta.ok)
    throw new Error(`Falha ao baixar a imagem (${resposta.status})`);
  return createImageBitmap(await resposta.blob());
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Falha ao exportar a arte")),
      tipo,
      qualidade,
    ),
  );
}

/**
 * Desenha a arte num canvas fora da tela, no tamanho real, e exporta. Serve
 * para cada slide do carrossel (a prévia mostra só o slide atual).
 */
export async function exportarSlide(
  arte: Arte,
  fundo: ImagemFundo | null,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = arte.largura;
  canvas.height = arte.altura;
  desenharArte(canvas, arte, fundo);
  return exportarArte(canvas, Boolean(arte.imagem && fundo));
}

/**
 * Exporta a arte para enviar à biblioteca. Só cor e texto: PNG (pequeno e
 * nítido). Com foto: JPEG, que fica bem menor que PNG e cabe nos 5 MB.
 */
export async function exportarArte(
  canvas: HTMLCanvasElement,
  comFoto: boolean,
): Promise<File> {
  let blob: Blob;
  if (comFoto) {
    blob = await paraBlob(canvas, "image/jpeg", 0.92);
    if (blob.size > TAMANHO_MAXIMO)
      blob = await paraBlob(canvas, "image/jpeg", 0.8);
  } else {
    blob = await paraBlob(canvas, "image/png");
    if (blob.size > TAMANHO_MAXIMO)
      blob = await paraBlob(canvas, "image/jpeg", 0.92);
  }
  const extensao = blob.type === "image/png" ? "png" : "jpg";
  return new File([blob], `arte-${Date.now()}.${extensao}`, {
    type: blob.type,
  });
}

/** Baixa o arquivo no computador do usuário (sem enviar para a biblioteca). */
export function baixarArquivo(arquivo: File, nome: string) {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  // Dá tempo ao navegador de começar o download antes de liberar a URL
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Baixa vários arquivos, um de cada vez (o navegador pode pedir permissão uma vez). */
export async function baixarArquivos(
  arquivos: { arquivo: File; nome: string }[],
) {
  for (const [i, { arquivo, nome }] of arquivos.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 300));
    baixarArquivo(arquivo, nome);
  }
}

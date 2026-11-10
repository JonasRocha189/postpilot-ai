// Drawing the artwork on a <canvas>, exporting it and loading the background image.
// Kept apart from layout.ts because it depends on the browser (in the integration
// tests jsdom has no canvas and this module is replaced).
import { MAX_SIZE } from "@/features/images/file";
import {
  fitText,
  LINE_HEIGHT,
  textBox,
  fontScale,
  ART_FONT,
  MIN_FONT,
  fontCss,
  margin,
  imageArea,
  FONT_WEIGHT,
  type Art,
  type TextBox,
} from "./layout";

/** Background image, already decoded. */
export type BackgroundImage = ImageBitmap;

/**
 * Draws the artwork on the canvas. The canvas is the artwork's size times
 * `scale` (1 in the preview and the export; smaller in the slide thumbnails).
 */
export function drawArt(
  canvas: HTMLCanvasElement,
  art: Art,
  background: BackgroundImage | null,
  scale = 1,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const { width, height } = art;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = art.color;
  ctx.fillRect(0, 0, width, height);

  if (art.image && background) {
    const area = imageArea(
      { width: background.width, height: background.height },
      art,
      art.image,
    );
    ctx.imageSmoothingQuality = "high";
    // The canvas clips whatever goes past the artwork edges
    ctx.drawImage(background, area.left, area.top, area.width, area.height);
    if (art.image.darken > 0) {
      // Darken only the image (the background color around it stays as chosen)
      ctx.fillStyle = `rgba(0, 0, 0, ${art.image.darken})`;
      ctx.fillRect(area.left, area.top, area.width, area.height);
    }
  }

  const positioned = positionText(ctx, art);
  if (!positioned) return;
  const { font, lines, box } = positioned;
  const lineHeight = font * LINE_HEIGHT;

  ctx.font = fontCss(font);
  ctx.fillStyle = art.textColor;
  ctx.textAlign = art.alignment;
  ctx.textBaseline = "middle";
  // A light shadow only over a photo, so the text stands out
  if (art.image && background) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = Math.round(font * 0.15);
  }
  lines.forEach((line, i) => {
    ctx.fillText(line, box.anchorX, box.top + lineHeight * (i + 0.5));
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

type PositionedText = { font: number; lines: string[]; box: TextBox };

/**
 * Wraps the text, fits the font and works out where the block goes. The
 * block is as wide as its widest line, so the drag area covers only the text.
 */
function positionText(
  ctx: CanvasRenderingContext2D,
  art: Art,
): PositionedText | null {
  const text = art.text.trim();
  if (!text) return null;

  const m = margin(art);
  const measure = (t: string, px: number) => {
    ctx.font = fontCss(px);
    return ctx.measureText(t).width;
  };
  const { font, lines } = fitText(
    text,
    { width: art.width - 2 * m, height: art.height - 2 * m },
    fontScale(art, art.font),
    fontScale(art, MIN_FONT),
    measure,
  );
  const block = {
    width: Math.max(...lines.map((line) => measure(line, font))),
    height: lines.length * font * LINE_HEIGHT,
  };
  return { font, lines, box: textBox(art, block, m) };
}

/**
 * The artwork's text block (artwork pixels), to know whether the user pressed
 * on the text in the preview. null when there is no text.
 */
export function textArea(art: Art): TextBox | null {
  const ctx = document.createElement("canvas").getContext("2d");
  return ctx ? (positionText(ctx, art)?.box ?? null) : null;
}

/** Waits for the artwork font to load (otherwise the canvas uses the fallback font). */
export async function loadFont() {
  try {
    await document.fonts.load(`${FONT_WEIGHT} 64px ${ART_FONT}`);
  } catch {
    // Without the font, the artwork uses the fallback font (sans-serif)
  }
}

/**
 * Downloads the library image and decodes it. Uses fetch without cache: a
 * cached copy without the CORS headers would "taint" the canvas and block the export.
 */
export async function loadImage(url: string): Promise<BackgroundImage> {
  const answer = await fetch(url, { cache: "no-store", mode: "cors" });
  if (!answer.ok)
    throw new Error(`Falha ao baixar a imagem (${answer.status})`);
  return createImageBitmap(await answer.blob());
}

function paraBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Falha ao exportar a arte")),
      type,
      quality,
    ),
  );
}

/**
 * Draws the artwork on an off-screen canvas, at full size, and exports it.
 * Used for each carousel slide (the preview shows only the current slide).
 */
export async function exportSlide(
  art: Art,
  background: BackgroundImage | null,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = art.width;
  canvas.height = art.height;
  drawArt(canvas, art, background);
  return exportArt(canvas, Boolean(art.image && background));
}

/**
 * Exports the artwork to upload to the library. Color and text only: PNG
 * (small and sharp). With a photo: JPEG, much smaller than PNG, within 5 MB.
 */
export async function exportArt(
  canvas: HTMLCanvasElement,
  withPhoto: boolean,
): Promise<File> {
  let blob: Blob;
  if (withPhoto) {
    blob = await paraBlob(canvas, "image/jpeg", 0.92);
    if (blob.size > MAX_SIZE) blob = await paraBlob(canvas, "image/jpeg", 0.8);
  } else {
    blob = await paraBlob(canvas, "image/png");
    if (blob.size > MAX_SIZE) blob = await paraBlob(canvas, "image/jpeg", 0.92);
  }
  const extension = blob.type === "image/png" ? "png" : "jpg";
  return new File([blob], `arte-${Date.now()}.${extension}`, {
    type: blob.type,
  });
}

/** Downloads the file to the user's computer (without uploading it to the library). */
export function downloadFile(file: File, name: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Gives the browser time to start the download before revoking the URL
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads several files, one at a time (the browser may ask for permission once). */
export async function downloadFiles(files: { file: File; name: string }[]) {
  for (const [i, { file, name }] of files.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 300));
    downloadFile(file, name);
  }
}

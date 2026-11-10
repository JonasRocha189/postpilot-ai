// Post artwork math (no DOM): sizes per network, line wrapping,
// text fitting and background image cropping. Drawing lives in canvas.ts.
import type { Network } from "@/lib/domain";

export type ArtSize = {
  width: number;
  height: number;
  /** Ratio label (e.g. "4:5") */
  ratio: string;
};

/** Recommended single-image sizes per network (the first is the default). */
export const ART_SIZES: Record<Network, readonly ArtSize[]> = {
  instagram: [
    { width: 1080, height: 1350, ratio: "4:5" },
    { width: 1080, height: 1080, ratio: "1:1" },
  ],
  linkedin: [
    { width: 1200, height: 1200, ratio: "1:1" },
    { width: 1080, height: 1350, ratio: "4:5" },
    { width: 1200, height: 627, ratio: "1.91:1" },
  ],
  x: [
    { width: 1600, height: 900, ratio: "16:9" },
    { width: 1080, height: 1080, ratio: "1:1" },
  ],
};

export type TextPosition = "top" | "middle" | "bottom";
export type TextAlignment = "left" | "center" | "right";

export type ImageBackground = {
  /**
   * 1 = covers the whole artwork; above 1 it zooms in; below 1 it gets smaller
   * and the background color shows around it
   */
  zoom: number;
  /** Center of the image, as a fraction of the artwork (0.5 = centered). Dragged freely, like the text */
  x: number;
  y: number;
  /** Dark layer over the image (0 to 1), so the text stays readable */
  darken: number;
};

/** Center of the dragged text block, as a fraction of the artwork (0 to 1). */
export type TextPoint = { x: number; y: number };

export type Art = {
  width: number;
  height: number;
  /** Background color (shows when there is no image) */
  color: string;
  /** Background image settings; null = color-only background */
  image: ImageBackground | null;
  text: string;
  textColor: string;
  /** Font size on a 1080 px wide artwork (scales with the artwork) */
  font: number;
  alignment: TextAlignment;
  position: TextPosition;
  /** Free position (dragged text); null = uses `position` and `alignment` */
  point: TextPoint | null;
};

/** The artwork's font family (the same as the interface, loaded from Google Fonts). */
export const ART_FONT = "Outfit";
export const FONT_WEIGHT = 600;
export const LINE_HEIGHT = 1.2;
/** Smallest font readable on mobile (on a 1080 px artwork), see Best practices. */
export const MIN_FONT = 24;
/** Inner margin, as a fraction of the artwork's smaller side. */
const MARGIN = 0.08;

/** Font in artwork pixels (the font is designed for 1080 px wide). */
export const fontScale = (art: Pick<Art, "width">, font: number) =>
  Math.round((font * art.width) / 1080);

export const fontCss = (px: number) =>
  `${FONT_WEIGHT} ${px}px ${ART_FONT}, sans-serif`;

export const margin = (art: Pick<Art, "width" | "height">) =>
  Math.round(Math.min(art.width, art.height) * MARGIN);

type Measure = (text: string) => number;

/**
 * Wraps the text into lines that fit `maxWidth`. Keeps the user's line
 * breaks; words longer than a line are cut.
 */
export function wrapLines(
  text: string,
  maxWidth: number,
  measure: Measure,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const attempt = line ? `${line} ${word}` : word;
      if (measure(attempt) <= maxWidth) {
        line = attempt;
        continue;
      }
      if (line) lines.push(line);
      // A single word longer than the line: cut by character
      line = "";
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > maxWidth) {
          lines.push(line);
          line = character;
        } else {
          line += character;
        }
      }
    }
    lines.push(line);
  }
  // Drops empty lines at the start and the end (keeps the ones in between)
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

/**
 * Wraps the text and shrinks the font until it fits the box (not below the
 * minimum font). `measure(text, px)` returns the text width at that font size.
 */
export function fitText(
  text: string,
  box: { width: number; height: number },
  font: number,
  minFont: number,
  measure: (text: string, px: number) => number,
): { font: number; lines: string[] } {
  let px = Math.max(font, minFont);
  for (;;) {
    const lines = wrapLines(text, box.width, (t) => measure(t, px));
    const height = lines.length * px * LINE_HEIGHT;
    if (height <= box.height || px <= minFont) {
      return { font: px, lines };
    }
    px = Math.max(minFont, px - Math.max(2, Math.round(px * 0.05)));
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
  image: { width: number; height: number },
  artwork: { width: number; height: number },
  adjust: Pick<ImageBackground, "zoom" | "x" | "y">,
): ImageArea {
  const scale =
    Math.max(artwork.width / image.width, artwork.height / image.height) *
    clamp(adjust.zoom, ZOOM_MIN, ZOOM_MAX);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    left: clampCenter(adjust.x) * artwork.width - width / 2,
    top: clampCenter(adjust.y) * artwork.height - height / 2,
    width,
    height,
  };
}

/** Does the image cover the whole artwork (no background color showing)? */
export function coversArtwork(
  area: ImageArea,
  artwork: { width: number; height: number },
) {
  // Tolerance for rounding in the scale
  const e = 0.5;
  return (
    area.left <= e &&
    area.top <= e &&
    area.left + area.width >= artwork.width - e &&
    area.top + area.height >= artwork.height - e
  );
}

/** Position (top) of the text block for the chosen position. */
export function textTop(
  position: TextPosition,
  artHeight: number,
  textHeight: number,
  padding: number,
) {
  if (position === "top") return padding;
  if (position === "bottom") return artHeight - padding - textHeight;
  return (artHeight - textHeight) / 2;
}

/** Text block on the artwork (pixels): rectangle and the x the lines align to. */
export type TextBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  /** x passed to fillText (start, center or end of the block, per the alignment) */
  anchorX: number;
};

type Dimensions = { width: number; height: number };

/** Block center, clamped so the whole block stays within the margins. */
function clampedCenter(
  fraction: number,
  total: number,
  size: number,
  padding: number,
) {
  const min = padding + size / 2;
  const max = total - padding - size / 2;
  // Block larger than the usable area: stays centered
  if (min > max) return total / 2;
  return Math.min(max, Math.max(min, fraction * total));
}

/**
 * Free point adjusted so the block (of size `block`) doesn't cross the
 * margins. Used while dragging, so the text "stops" at the edge instead of the
 * point moving past it.
 */
export function clampPoint(
  point: TextPoint,
  art: Dimensions,
  block: Dimensions,
  padding: number,
): TextPoint {
  return {
    x: clampedCenter(point.x, art.width, block.width, padding) / art.width,
    y: clampedCenter(point.y, art.height, block.height, padding) / art.height,
  };
}

/**
 * Where the text block goes (`block` = width of the widest line and height of
 * all lines). With `point`, the block is centered on it (within the margins);
 * without, it follows the fixed position (top, middle, bottom) and the alignment.
 */
export function textBox(
  art: Pick<Art, "width" | "height" | "alignment" | "position" | "point">,
  block: Dimensions,
  padding: number,
): TextBox {
  let left: number;
  let top: number;
  if (art.point) {
    const p = clampPoint(art.point, art, block, padding);
    left = p.x * art.width - block.width / 2;
    top = p.y * art.height - block.height / 2;
  } else {
    left =
      art.alignment === "left"
        ? padding
        : art.alignment === "right"
          ? art.width - padding - block.width
          : (art.width - block.width) / 2;
    top = textTop(art.position, art.height, block.height, padding);
  }
  const anchorX =
    art.alignment === "left"
      ? left
      : art.alignment === "right"
        ? left + block.width
        : left + block.width / 2;
  return { left, top, ...block, anchorX };
}

/** Is the point (artwork pixels) over the block, with some slack around it? */
export function insideBox(box: TextBox, x: number, y: number, slack = 0) {
  return (
    x >= box.left - slack &&
    x <= box.left + box.width + slack &&
    y >= box.top - slack &&
    y <= box.top + box.height + slack
  );
}

/** Relative luminance of a #rrggbb color (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text color that contrasts with the background (white or near black). */
export const contrastingColor = (background: string) =>
  luminance(background) > 0.4 ? "#101828" : "#FFFFFF";

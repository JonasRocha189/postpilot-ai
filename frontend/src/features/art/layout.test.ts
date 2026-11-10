import { describe, expect, it } from "vitest";
import {
  fitText,
  textBox,
  contrastingColor,
  insideBox,
  fontScale,
  clampPoint,
  coversArtwork,
  imageArea,
  wrapLines,
  ART_SIZES,
  textTop,
} from "./layout";

// Fake font: every character is 10 px wide at 10 px (width = chars × px)
const measure = (text: string, px = 10) => Array.from(text).length * px;

describe("ART_SIZES", () => {
  it("starts with the recommended size of each network", () => {
    expect(ART_SIZES.instagram[0]).toMatchObject({
      width: 1080,
      height: 1350,
    });
    expect(ART_SIZES.linkedin[0]).toMatchObject({
      width: 1200,
      height: 1200,
    });
    expect(ART_SIZES.x[0]).toMatchObject({ width: 1600, height: 900 });
  });
});

describe("wrapLines", () => {
  it("wraps words greedily to the line width", () => {
    expect(wrapLines("aaa bbb ccc dd", 70, measure)).toEqual([
      "aaa bbb",
      "ccc dd",
    ]);
  });

  it("keeps the user's line breaks and trims empty edges", () => {
    expect(wrapLines("\nTítulo\n\nsub\n", 100, measure)).toEqual([
      "Título",
      "",
      "sub",
    ]);
  });

  it("breaks a word longer than the line", () => {
    expect(wrapLines("abcdefgh", 30, measure)).toEqual(["abc", "def", "gh"]);
  });

  it("counts an emoji as one character", () => {
    expect(wrapLines("🚀🚀🚀", 20, measure)).toEqual(["🚀🚀", "🚀"]);
  });
});

describe("fitText", () => {
  it("keeps the font when the text fits", () => {
    expect(fitText("Oi", { width: 100, height: 100 }, 20, 8, measure)).toEqual({
      font: 20,
      lines: ["Oi"],
    });
  });

  it("shrinks the font until the lines fit in the box", () => {
    const text = "palavra ".repeat(12);
    const box = { width: 200, height: 100 };
    const { font, lines } = fitText(text, box, 40, 8, measure);
    expect(font).toBeLessThan(40);
    expect(lines.length * font * 1.2).toBeLessThanOrEqual(box.height);
  });

  it("never goes below the minimum font", () => {
    const { font } = fitText(
      "x ".repeat(500),
      { width: 50, height: 20 },
      40,
      12,
      measure,
    );
    expect(font).toBe(12);
  });
});

describe("fontScale", () => {
  it("scales the font with the artwork width (designed for 1080 px)", () => {
    expect(fontScale({ width: 1080 }, 72)).toBe(72);
    expect(fontScale({ width: 1600 }, 72)).toBe(107);
  });
});

describe("imageArea", () => {
  const photo = { width: 2000, height: 1000 };
  const artwork = { width: 1080, height: 1350 };
  const centered = { zoom: 1, x: 0.5, y: 0.5 };

  it("covers a 4:5 artwork with a landscape photo, centered, without distortion", () => {
    // The height limits: scale 1.35 → 2700 × 1350, the sides go past the edges
    const area = imageArea(photo, artwork, centered);
    expect(area.width).toBeCloseTo(2700);
    expect(area.height).toBeCloseTo(1350);
    expect(area.left).toBeCloseTo(-810); // (1080 − 2700) / 2
    expect(area.top).toBeCloseTo(0);
    expect(area.width / area.height).toBeCloseTo(2);
    expect(coversArtwork(area, artwork)).toBe(true);
  });

  it("moves freely with the center, which stays inside the artwork", () => {
    const left = imageArea(photo, artwork, { ...centered, x: 0 });
    expect(left.left).toBeCloseTo(-1350); // center on the left edge
    const below = imageArea(photo, artwork, { ...centered, y: 0.9 });
    expect(below.top).toBeCloseTo(1215 - 675);
    expect(coversArtwork(below, artwork)).toBe(false);
    // Past the edge: the center stops at the edge
    expect(imageArea(photo, artwork, { ...centered, x: -2 }).left).toBeCloseTo(
      left.left,
    );
  });

  it("zooms in, and out down to the minimum (the color shows around it)", () => {
    expect(
      imageArea(photo, artwork, { ...centered, zoom: 2 }).height,
    ).toBeCloseTo(2700);
    const small = imageArea(photo, artwork, { ...centered, zoom: 0.5 });
    expect(small.width).toBeCloseTo(1350);
    expect(small.height).toBeCloseTo(675);
    expect(small.top).toBeCloseTo((1350 - 675) / 2);
    expect(coversArtwork(small, artwork)).toBe(false);
    // Below the minimum (0.2) it is limited
    expect(
      imageArea(photo, artwork, { ...centered, zoom: 0 }).height,
    ).toBeCloseTo(1350 * 0.2);
  });
});

describe("textTop", () => {
  it("places the text block at the top, middle or bottom", () => {
    expect(textTop("top", 1000, 200, 80)).toBe(80);
    expect(textTop("middle", 1000, 200, 80)).toBe(400);
    expect(textTop("bottom", 1000, 200, 80)).toBe(720);
  });
});

describe("textBox", () => {
  // 1000 × 800 artwork, 80 px margin, 200 × 100 text block
  const base = {
    width: 1000,
    height: 800,
    alignment: "center" as const,
    position: "middle" as const,
    point: null,
  };
  const block = { width: 200, height: 100 };

  it("follows the fixed position and alignment without a free point", () => {
    expect(textBox(base, block, 80)).toEqual({
      left: 400,
      top: 350,
      width: 200,
      height: 100,
      anchorX: 500,
    });
    const leftBottom = textBox(
      { ...base, alignment: "left", position: "bottom" },
      block,
      80,
    );
    expect(leftBottom).toMatchObject({
      left: 80,
      top: 620,
      anchorX: 80,
    });
    const rightTop = textBox(
      { ...base, alignment: "right", position: "top" },
      block,
      80,
    );
    expect(rightTop).toMatchObject({
      left: 720,
      top: 80,
      anchorX: 920,
    });
  });

  it("centers the block on the free point; alignment moves the anchor only", () => {
    const free = { ...base, point: { x: 0.3, y: 0.25 } };
    expect(textBox(free, block, 80)).toMatchObject({
      left: 200, // 300 - 100
      top: 150, // 200 - 50
      anchorX: 300,
    });
    expect(textBox({ ...free, alignment: "left" }, block, 80)).toMatchObject({
      left: 200,
      anchorX: 200,
    });
    expect(textBox({ ...free, alignment: "right" }, block, 80)).toMatchObject({
      left: 200,
      anchorX: 400,
    });
  });

  it("keeps a dragged block inside the margins", () => {
    const corner = { ...base, point: { x: 0, y: 1 } };
    expect(textBox(corner, block, 80)).toMatchObject({
      left: 80,
      top: 620, // 800 - 80 - 100
    });
  });
});

describe("clampPoint", () => {
  it("stops the point where the block touches the margin", () => {
    const art = { width: 1000, height: 800 };
    expect(
      clampPoint({ x: -0.5, y: 2 }, art, { width: 200, height: 100 }, 80),
    ).toEqual({ x: 0.18, y: 0.8375 }); // centers 180 and 670
    expect(
      clampPoint({ x: 0.4, y: 0.5 }, art, { width: 200, height: 100 }, 80),
    ).toEqual({ x: 0.4, y: 0.5 });
  });

  it("centers a block bigger than the usable area", () => {
    expect(
      clampPoint(
        { x: 0.1, y: 0.1 },
        { width: 1000, height: 800 },
        { width: 900, height: 100 },
        80,
      ).x,
    ).toBe(0.5);
  });
});

describe("insideBox", () => {
  const box = {
    left: 100,
    top: 100,
    width: 200,
    height: 50,
    anchorX: 200,
  };

  it("hits the block, with an optional margin around it", () => {
    expect(insideBox(box, 150, 120)).toBe(true);
    expect(insideBox(box, 95, 120)).toBe(false);
    expect(insideBox(box, 95, 120, 10)).toBe(true);
    expect(insideBox(box, 150, 200, 10)).toBe(false);
  });
});

describe("contrastingColor", () => {
  it("uses dark text on light backgrounds and white on dark ones", () => {
    expect(contrastingColor("#FFFFFF")).toBe("#101828");
    expect(contrastingColor("#F2F4F7")).toBe("#101828");
    expect(contrastingColor("#101828")).toBe("#FFFFFF");
    expect(contrastingColor("#465FFF")).toBe("#FFFFFF");
  });
});

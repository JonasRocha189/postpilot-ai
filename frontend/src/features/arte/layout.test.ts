import { describe, expect, it } from "vitest";
import {
  ajustarTexto,
  corQueContrasta,
  escalaFonte,
  quebrarLinhas,
  recorteCover,
  sobraCover,
  TAMANHOS_ARTE,
  topoDoTexto,
} from "./layout";

// Fake font: every character is 10 px wide at 10 px (width = chars × px)
const medir = (texto: string, px = 10) => Array.from(texto).length * px;

describe("TAMANHOS_ARTE", () => {
  it("starts with the recommended size of each network", () => {
    expect(TAMANHOS_ARTE.instagram[0]).toMatchObject({
      largura: 1080,
      altura: 1350,
    });
    expect(TAMANHOS_ARTE.linkedin[0]).toMatchObject({
      largura: 1200,
      altura: 1200,
    });
    expect(TAMANHOS_ARTE.x[0]).toMatchObject({ largura: 1600, altura: 900 });
  });
});

describe("quebrarLinhas", () => {
  it("wraps words greedily to the line width", () => {
    expect(quebrarLinhas("aaa bbb ccc dd", 70, medir)).toEqual([
      "aaa bbb",
      "ccc dd",
    ]);
  });

  it("keeps the user's line breaks and trims empty edges", () => {
    expect(quebrarLinhas("\nTítulo\n\nsub\n", 100, medir)).toEqual([
      "Título",
      "",
      "sub",
    ]);
  });

  it("breaks a word longer than the line", () => {
    expect(quebrarLinhas("abcdefgh", 30, medir)).toEqual(["abc", "def", "gh"]);
  });

  it("counts an emoji as one character", () => {
    expect(quebrarLinhas("🚀🚀🚀", 20, medir)).toEqual(["🚀🚀", "🚀"]);
  });
});

describe("ajustarTexto", () => {
  it("keeps the font when the text fits", () => {
    expect(
      ajustarTexto("Oi", { largura: 100, altura: 100 }, 20, 8, medir),
    ).toEqual({ fonte: 20, linhas: ["Oi"] });
  });

  it("shrinks the font until the lines fit in the box", () => {
    const texto = "palavra ".repeat(12);
    const caixa = { largura: 200, altura: 100 };
    const { fonte, linhas } = ajustarTexto(texto, caixa, 40, 8, medir);
    expect(fonte).toBeLessThan(40);
    expect(linhas.length * fonte * 1.2).toBeLessThanOrEqual(caixa.altura);
  });

  it("never goes below the minimum font", () => {
    const { fonte } = ajustarTexto(
      "x ".repeat(500),
      { largura: 50, altura: 20 },
      40,
      12,
      medir,
    );
    expect(fonte).toBe(12);
  });
});

describe("escalaFonte", () => {
  it("scales the font with the artwork width (designed for 1080 px)", () => {
    expect(escalaFonte({ largura: 1080 }, 72)).toBe(72);
    expect(escalaFonte({ largura: 1600 }, 72)).toBe(107);
  });
});

describe("recorteCover", () => {
  const centro = { zoom: 1, focoX: 0.5, focoY: 0.5 };

  it("crops the sides of a landscape photo for a 4:5 artwork", () => {
    // 2000×1000 photo → 1080×1350: the height limits, width is cropped
    const r = recorteCover(
      { largura: 2000, altura: 1000 },
      { largura: 1080, altura: 1350 },
      centro,
    );
    expect(r.sh).toBeCloseTo(1000);
    expect(r.sw).toBeCloseTo(800); // 1000 × 4/5
    expect(r.sx).toBeCloseTo(600); // centered: (2000 - 800) / 2
    expect(r.sy).toBeCloseTo(0);
  });

  it("keeps the proportion of the artwork (no distortion)", () => {
    const r = recorteCover(
      { largura: 640, altura: 480 },
      { largura: 1600, altura: 900 },
      { zoom: 1.7, focoX: 0.2, focoY: 0.9 },
    );
    expect(r.sw / r.sh).toBeCloseTo(1600 / 900);
    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sy + r.sh).toBeLessThanOrEqual(480 + 1e-9);
  });

  it("moves the visible part with the focus and zooms in", () => {
    const imagem = { largura: 2000, altura: 1000 };
    const arte = { largura: 1080, altura: 1350 };
    expect(recorteCover(imagem, arte, { ...centro, focoX: 0 }).sx).toBe(0);
    expect(recorteCover(imagem, arte, { ...centro, focoX: 1 }).sx).toBeCloseTo(
      1200,
    );
    const perto = recorteCover(imagem, arte, { ...centro, zoom: 2 });
    expect(perto.sh).toBeCloseTo(500);
  });
});

describe("sobraCover", () => {
  it("tells how much of the scaled photo is left outside the artwork", () => {
    const sobra = sobraCover(
      { largura: 2000, altura: 1000 },
      { largura: 1080, altura: 1350 },
      1,
    );
    expect(sobra.x).toBeCloseTo(1620); // 2000 × 1.35 − 1080
    expect(sobra.y).toBeCloseTo(0);
  });
});

describe("topoDoTexto", () => {
  it("places the text block at the top, middle or bottom", () => {
    expect(topoDoTexto("top", 1000, 200, 80)).toBe(80);
    expect(topoDoTexto("middle", 1000, 200, 80)).toBe(400);
    expect(topoDoTexto("bottom", 1000, 200, 80)).toBe(720);
  });
});

describe("corQueContrasta", () => {
  it("uses dark text on light backgrounds and white on dark ones", () => {
    expect(corQueContrasta("#FFFFFF")).toBe("#101828");
    expect(corQueContrasta("#F2F4F7")).toBe("#101828");
    expect(corQueContrasta("#101828")).toBe("#FFFFFF");
    expect(corQueContrasta("#465FFF")).toBe("#FFFFFF");
  });
});

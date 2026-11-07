import { describe, expect, it } from "vitest";
import {
  ajustarTexto,
  caixaDoTexto,
  corQueContrasta,
  dentroDaCaixa,
  escalaFonte,
  limitarPonto,
  coversArtwork,
  imageArea,
  quebrarLinhas,
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

describe("imageArea", () => {
  const photo = { largura: 2000, altura: 1000 };
  const artwork = { largura: 1080, altura: 1350 };
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

describe("topoDoTexto", () => {
  it("places the text block at the top, middle or bottom", () => {
    expect(topoDoTexto("top", 1000, 200, 80)).toBe(80);
    expect(topoDoTexto("middle", 1000, 200, 80)).toBe(400);
    expect(topoDoTexto("bottom", 1000, 200, 80)).toBe(720);
  });
});

describe("caixaDoTexto", () => {
  // 1000 × 800 artwork, 80 px margin, 200 × 100 text block
  const base = {
    largura: 1000,
    altura: 800,
    alinhamento: "center" as const,
    posicao: "middle" as const,
    ponto: null,
  };
  const bloco = { largura: 200, altura: 100 };

  it("follows the fixed position and alignment without a free point", () => {
    expect(caixaDoTexto(base, bloco, 80)).toEqual({
      esquerda: 400,
      topo: 350,
      largura: 200,
      altura: 100,
      ancoraX: 500,
    });
    const esquerdaBase = caixaDoTexto(
      { ...base, alinhamento: "left", posicao: "bottom" },
      bloco,
      80,
    );
    expect(esquerdaBase).toMatchObject({
      esquerda: 80,
      topo: 620,
      ancoraX: 80,
    });
    const direitaTopo = caixaDoTexto(
      { ...base, alinhamento: "right", posicao: "top" },
      bloco,
      80,
    );
    expect(direitaTopo).toMatchObject({
      esquerda: 720,
      topo: 80,
      ancoraX: 920,
    });
  });

  it("centers the block on the free point; alignment moves the anchor only", () => {
    const livre = { ...base, ponto: { x: 0.3, y: 0.25 } };
    expect(caixaDoTexto(livre, bloco, 80)).toMatchObject({
      esquerda: 200, // 300 - 100
      topo: 150, // 200 - 50
      ancoraX: 300,
    });
    expect(
      caixaDoTexto({ ...livre, alinhamento: "left" }, bloco, 80),
    ).toMatchObject({ esquerda: 200, ancoraX: 200 });
    expect(
      caixaDoTexto({ ...livre, alinhamento: "right" }, bloco, 80),
    ).toMatchObject({ esquerda: 200, ancoraX: 400 });
  });

  it("keeps a dragged block inside the margins", () => {
    const canto = { ...base, ponto: { x: 0, y: 1 } };
    expect(caixaDoTexto(canto, bloco, 80)).toMatchObject({
      esquerda: 80,
      topo: 620, // 800 - 80 - 100
    });
  });
});

describe("limitarPonto", () => {
  it("stops the point where the block touches the margin", () => {
    const arte = { largura: 1000, altura: 800 };
    expect(
      limitarPonto({ x: -0.5, y: 2 }, arte, { largura: 200, altura: 100 }, 80),
    ).toEqual({ x: 0.18, y: 0.8375 }); // centers 180 and 670
    expect(
      limitarPonto({ x: 0.4, y: 0.5 }, arte, { largura: 200, altura: 100 }, 80),
    ).toEqual({ x: 0.4, y: 0.5 });
  });

  it("centers a block bigger than the usable area", () => {
    expect(
      limitarPonto(
        { x: 0.1, y: 0.1 },
        { largura: 1000, altura: 800 },
        { largura: 900, altura: 100 },
        80,
      ).x,
    ).toBe(0.5);
  });
});

describe("dentroDaCaixa", () => {
  const caixa = {
    esquerda: 100,
    topo: 100,
    largura: 200,
    altura: 50,
    ancoraX: 200,
  };

  it("hits the block, with an optional margin around it", () => {
    expect(dentroDaCaixa(caixa, 150, 120)).toBe(true);
    expect(dentroDaCaixa(caixa, 95, 120)).toBe(false);
    expect(dentroDaCaixa(caixa, 95, 120, 10)).toBe(true);
    expect(dentroDaCaixa(caixa, 150, 200, 10)).toBe(false);
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

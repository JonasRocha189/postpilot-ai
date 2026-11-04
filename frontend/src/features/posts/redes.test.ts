import { describe, expect, it } from "vitest";
import {
  contarCaracteres,
  formatarHashtags,
  parseHashtags,
  textoFinal,
} from "./redes";

describe("parseHashtags", () => {
  it("splits by spaces and commas, drops # and repeated tags (case-insensitive)", () => {
    expect(parseHashtags("#nuvem, marketing  #Nuvem ##pme")).toEqual([
      "nuvem",
      "marketing",
      "pme",
    ]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseHashtags("  , ")).toEqual([]);
  });
});

describe("textoFinal / contarCaracteres", () => {
  it("appends the hashtags after a blank line", () => {
    expect(textoFinal(" Olá ", ["a", "b"])).toBe("Olá\n\n#a #b");
    expect(formatarHashtags([])).toBe("");
    expect(textoFinal("Olá", [])).toBe("Olá");
  });

  it("counts emojis as one character", () => {
    expect(contarCaracteres("🚀", [])).toBe(1);
    expect(contarCaracteres("Oi", ["x"])).toBe("Oi\n\n#x".length);
  });
});

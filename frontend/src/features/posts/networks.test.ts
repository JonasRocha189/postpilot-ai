import { describe, expect, it } from "vitest";
import {
  countCharacters,
  formatHashtags,
  parseHashtags,
  finalText,
} from "./networks";

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
    expect(finalText(" Olá ", ["a", "b"])).toBe("Olá\n\n#a #b");
    expect(formatHashtags([])).toBe("");
    expect(finalText("Olá", [])).toBe("Olá");
  });

  it("counts emojis as one character", () => {
    expect(countCharacters("🚀", [])).toBe(1);
    expect(countCharacters("Oi", ["x"])).toBe("Oi\n\n#x".length);
  });
});

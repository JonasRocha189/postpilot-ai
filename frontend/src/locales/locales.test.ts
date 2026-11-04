import { describe, expect, it } from "vitest";
import en from "./en/app.json";
import ptBR from "./pt-BR/app.json";

type Tree = { [key: string]: string | string[] | Tree };

/** "a.b.c" for every leaf. Plural suffixes (_one, _other) are kept. */
function keys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "object" && !Array.isArray(v)
      ? keys(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

/** "{name}" placeholders used in each text. */
function placeholders(tree: Tree, prefix = ""): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([k, v]) => {
      if (typeof v === "string") {
        return [[`${prefix}${k}`, (v.match(/\{\w+\}/g) ?? []).sort()]];
      }
      if (Array.isArray(v)) return [];
      return Object.entries(placeholders(v, `${prefix}${k}.`));
    }),
  );
}

describe("locales (namespace app)", () => {
  it("pt-BR and en have exactly the same keys", () => {
    const pt = new Set(keys(ptBR as Tree));
    const enKeys = new Set(keys(en as Tree));
    expect([...pt].filter((k) => !enKeys.has(k))).toEqual([]);
    expect([...enKeys].filter((k) => !pt.has(k))).toEqual([]);
  });

  it("each text uses the same {placeholders} in both languages", () => {
    const pt = placeholders(ptBR as Tree);
    const enP = placeholders(en as Tree);
    const diferentes = Object.keys(pt).filter(
      (k) => k in enP && pt[k].join() !== enP[k].join(),
    );
    expect(diferentes).toEqual([]);
  });

  it("has no empty texts", () => {
    const vazios = Object.entries(placeholders(ptBR as Tree)).length;
    expect(vazios).toBeGreaterThan(0);
    const emBranco = keys(ptBR as Tree).filter((k) => {
      const valor = k
        .split(".")
        .reduce<unknown>((o, p) => (o as Tree)?.[p], ptBR);
      return typeof valor === "string" && valor.trim() === "";
    });
    expect(emBranco).toEqual([]);
  });
});

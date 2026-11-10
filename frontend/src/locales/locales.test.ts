import { describe, expect, it } from "vitest";
import en from "./en/app.json";
import ptBR from "./pt-BR/app.json";

type Node = string | Node[] | { [key: string]: Node };

/** Every text leaf as [path, text]. Lists use the index: "principles.0.title". */
function leaves(node: Node, prefix = ""): [string, string][] {
  if (typeof node === "string") return [[prefix, node]];
  const entries = Array.isArray(node)
    ? node.map((v, i) => [String(i), v] as const)
    : Object.entries(node);
  return entries.flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

const pt = new Map(leaves(ptBR as unknown as Node));
const enLeaves = new Map(leaves(en as unknown as Node));

/** "{name}" placeholders of a text, sorted. */
const placeholders = (text: string) =>
  (text.match(/\{\w+\}/g) ?? []).sort().join();

describe("locales (namespace app)", () => {
  it("pt-BR and en have exactly the same keys (and list sizes)", () => {
    expect([...pt.keys()].filter((k) => !enLeaves.has(k))).toEqual([]);
    expect([...enLeaves.keys()].filter((k) => !pt.has(k))).toEqual([]);
  });

  it("each text uses the same {placeholders} in both languages", () => {
    const different = [...pt].filter(
      ([k, text]) =>
        enLeaves.has(k) &&
        placeholders(text) !== placeholders(enLeaves.get(k)!),
    );
    expect(different).toEqual([]);
  });

  it("has no empty texts", () => {
    expect(pt.size).toBeGreaterThan(0);
    const empty = [...pt, ...enLeaves].filter(([, text]) => text.trim() === "");
    expect(empty).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { MIME_POR_TIPO, TAMANHO_MAXIMO, tipoDaImagem } from "./arquivo";

const arquivo = (type: string) => new File(["x"], "foto", { type });

describe("tipoDaImagem", () => {
  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpeg"],
    ["image/webp", "webp"],
  ])("accepts %s", (mime, tipo) => {
    expect(tipoDaImagem(arquivo(mime))).toBe(tipo);
    expect(MIME_POR_TIPO[tipo as keyof typeof MIME_POR_TIPO]).toBe(mime);
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])(
    "rejects %s",
    (mime) => {
      expect(tipoDaImagem(arquivo(mime))).toBeNull();
    },
  );

  it("uses the same 5 MB limit as the backend", () => {
    expect(TAMANHO_MAXIMO).toBe(5 * 1024 * 1024);
  });
});

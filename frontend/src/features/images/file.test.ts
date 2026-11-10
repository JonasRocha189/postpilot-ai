import { describe, expect, it } from "vitest";
import { MIME_BY_TYPE, MAX_SIZE, imageType } from "./file";

const file = (type: string) => new File(["x"], "foto", { type });

describe("imageType", () => {
  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpeg"],
    ["image/webp", "webp"],
  ])("accepts %s", (mime, type) => {
    expect(imageType(file(mime))).toBe(type);
    expect(MIME_BY_TYPE[type as keyof typeof MIME_BY_TYPE]).toBe(mime);
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])(
    "rejects %s",
    (mime) => {
      expect(imageType(file(mime))).toBeNull();
    },
  );

  it("uses the same 5 MB limit as the backend", () => {
    expect(MAX_SIZE).toBe(5 * 1024 * 1024);
  });
});

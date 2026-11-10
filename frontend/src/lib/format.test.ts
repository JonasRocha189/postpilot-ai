import { describe, expect, it } from "vitest";
import { isoDay, parseData } from "./format";

describe("parseData", () => {
  it("reads a date-only string as a local date, not UTC midnight", () => {
    const d = parseData("2026-11-20");
    // In Brazil (UTC-3), new Date("2026-11-20") would be Nov 19 at 21:00
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([
      2026, 10, 20,
    ]);
    expect(d.getHours()).toBe(0);
  });

  it("keeps full ISO timestamps as they are", () => {
    const iso = "2026-11-20T15:30:00.000Z";
    expect(parseData(iso).toISOString()).toBe(iso);
  });

  it("accepts Date objects", () => {
    const d = new Date(2026, 0, 5);
    expect(parseData(d).getTime()).toBe(d.getTime());
  });
});

describe("isoDay", () => {
  it("formats a local date as YYYY-MM-DD with zero padding", () => {
    expect(isoDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("round-trips with parseData", () => {
    expect(isoDay(parseData("2026-12-31"))).toBe("2026-12-31");
  });
});

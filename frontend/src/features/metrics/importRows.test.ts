import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";
import {
  autoMatch,
  parseCount,
  parseDate,
  parsePublishedAt,
  readMetricsCsv,
  templateCsv,
} from "./importRows";

describe("parseCsv", () => {
  it("reads quoted cells with commas, escaped quotes and line breaks", () => {
    expect(
      parseCsv('a,b\n"1,5","diz ""oi""\nem duas linhas"\n\n3,4\r\n'),
    ).toEqual([
      ["a", "b"],
      ["1,5", 'diz "oi"\nem duas linhas'],
      ["3", "4"],
    ]);
  });

  it("detects semicolon (Excel in Portuguese) and tab separators", () => {
    expect(parseCsv("\uFEFFdata;impressões\n02/11/2026;1.234")).toEqual([
      ["data", "impressões"],
      ["02/11/2026", "1.234"],
    ]);
    expect(parseCsv("date\tlikes\n2026-11-02\t5")).toEqual([
      ["date", "likes"],
      ["2026-11-02", "5"],
    ]);
  });

  it("round-trips through toCsv", () => {
    const rows = [
      ["post", "n"],
      ['Texto, com "aspas"', "3"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("parseDate and parseCount", () => {
  it("accepts ISO (with time) and dd/mm/yyyy, rejects impossible dates", () => {
    expect(parseDate("2026-11-02")).toBe("2026-11-02");
    expect(parseDate("2026-11-02 14:00 +0000")).toBe("2026-11-02");
    expect(parseDate("2/11/2026")).toBe("2026-11-02");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("ontem")).toBeNull();
  });

  it("keeps the publishing time when the cell has one", () => {
    expect(parsePublishedAt("2026-11-02")).toBe("2026-11-02T12:00:00Z");
    expect(parsePublishedAt("02/11/2026")).toBe("2026-11-02T12:00:00Z");
    expect(parsePublishedAt("2026-11-02 14:05 +0000")).toBe(
      "2026-11-02T14:05:00+00:00",
    );
    expect(parsePublishedAt("2026-11-02 18:30 -0300")).toBe(
      "2026-11-02T18:30:00-03:00",
    );
    expect(parsePublishedAt("2026-11-02T09:00:00.000Z")).toBe(
      "2026-11-02T09:00:00Z",
    );
    // No offset: the browser's time zone
    expect(parsePublishedAt("2026-11-02 08:00")).toBe(
      new Date(2026, 10, 2, 8, 0).toISOString(),
    );
    expect(parsePublishedAt("2026-11-02 25:00")).toBeNull();
    expect(parsePublishedAt("ontem")).toBeNull();
  });

  it("reads whole counts with thousand separators; empty is 0", () => {
    expect(parseCount("1.234")).toBe(1234);
    expect(parseCount("1,234,567")).toBe(1234567);
    expect(parseCount(" 42 ")).toBe(42);
    expect(parseCount("")).toBe(0);
    expect(parseCount("3,5")).toBeNull();
    expect(parseCount("12%")).toBeNull();
  });
});

describe("readMetricsCsv", () => {
  it("finds the columns by each network's names and converts the rows", () => {
    const { rows, missing } = readMetricsCsv(templateCsv("x"));
    expect(missing).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        publishedOn: "2026-11-02",
        publishedAt: "2026-11-02T12:00:00Z",
        label: "5 erros ao migrar para a nuvem",
        values: {
          impressions: 2720,
          likes: 65,
          comments: 13,
          shares: 9,
          clicks: 22,
        },
        errors: [],
      },
      expect.objectContaining({
        publishedOn: "2026-11-05",
        values: {
          impressions: 1480,
          likes: 31,
          comments: 4,
          shares: 2,
          clicks: 11,
        },
      }),
    ]);
  });

  it("works with every network's template", () => {
    for (const network of ["linkedin", "instagram", "x"] as const) {
      const { rows, missing } = readMetricsCsv(templateCsv(network));
      expect(missing).toEqual([]);
      expect(rows).toHaveLength(2);
    }
  });

  it("accepts Portuguese headers; optional columns default to 0", () => {
    const { rows } = readMetricsCsv("Data;Impressões\n02/11/2026;500");
    expect(rows[0].values).toEqual({
      impressions: 500,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
    });
  });

  it("reports missing required columns and invalid cells", () => {
    expect(readMetricsCsv("post,likes\nx,1").missing).toEqual([
      "date",
      "impressions",
    ]);
    const { rows } = readMetricsCsv("date,impressions\nontem,abc");
    expect(rows[0].errors).toEqual([
      "metricsImport.errors.invalidDate",
      "metricsImport.errors.invalidNumber",
    ]);
  });
});

describe("autoMatch", () => {
  const candidates = [
    { id: "v1", title: "A", date: "2026-11-02" },
    { id: "v2", title: "B", date: "2026-11-05" },
    { id: "v3", title: "C", date: "2026-11-05" },
  ];

  it("matches the only variation published that day", () => {
    expect(autoMatch({ publishedOn: "2026-11-02" }, candidates)).toBe("v1");
  });

  it("leaves it to the user when there are none or several", () => {
    expect(autoMatch({ publishedOn: "2026-11-05" }, candidates)).toBeNull();
    expect(autoMatch({ publishedOn: "2026-11-09" }, candidates)).toBeNull();
    expect(autoMatch({ publishedOn: null }, candidates)).toBeNull();
  });
});

// Reads a network's metrics export (CSV) into rows to import, and matches
// each row to a published variation of the same network.
import type { Rede } from "@/lib/dominio";
import { parseCsv, toCsv } from "./csv";

export const METRIC_FIELDS = [
  "impressions",
  "likes",
  "comments",
  "shares",
  "clicks",
] as const;
export type MetricField = (typeof METRIC_FIELDS)[number];

type Column = "date" | "post" | MetricField;

/**
 * Accepted header names (lowercase, no accents). Our template uses the first
 * name; the others are the names each network uses in its own export, in
 * English and Portuguese. LinkedIn's list will be checked against a real
 * export; X's and Instagram's follow their documentation.
 */
const COLUMN_NAMES: Record<Column, string[]> = {
  date: [
    "date",
    "data",
    "created date",
    "post publish date",
    "publish time",
    "time",
    "data de publicacao",
    "horario de publicacao",
  ],
  post: [
    "post",
    "post title",
    "post text",
    "tweet text",
    "description",
    "text",
    "texto",
    "descricao",
    "post link",
    "permalink",
    "link",
    "url",
  ],
  impressions: ["impressions", "impressoes", "views", "visualizacoes"],
  likes: ["likes", "reactions", "curtidas", "reacoes"],
  comments: ["comments", "replies", "comentarios", "respostas"],
  shares: [
    "shares",
    "reposts",
    "retweets",
    "compartilhamentos",
    "republicacoes",
  ],
  clicks: ["clicks", "url clicks", "link clicks", "cliques", "cliques no link"],
};

/** Columns the file must have; the other numbers default to 0. */
const REQUIRED: Column[] = ["date", "impressions"];

const normalize = (header: string) =>
  header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** "2026-11-02", "2026-11-02 14:00 +0000" or "02/11/2026" → "2026-11-02". */
export function parseDate(value: string): string | null {
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  const parts = iso
    ? [iso[1], iso[2], iso[3]]
    : br
      ? [br[3], br[2], br[1]]
      : null;
  if (!parts) return null;
  const [y, m, d] = parts;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const ok =
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d);
  return ok ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null;
}

/** "1.234", "1,234", "1 234" or "" (→ 0). Null when it isn't a whole count. */
export function parseCount(value: string): number | null {
  const v = value.trim().replace(/\s/g, "");
  if (v === "" || v === "-") return 0;
  if (/^\d+$/.test(v)) return Number(v);
  if (/^\d{1,3}([.,]\d{3})+$/.test(v)) return Number(v.replace(/[.,]/g, ""));
  return null;
}

export type ImportRow = {
  /** Line in the file (the header is line 1) */
  line: number;
  /** YYYY-MM-DD, or null when the date is invalid */
  publishedOn: string | null;
  /** Post text or link from the file, to help the user recognize it */
  label: string;
  values: Record<MetricField, number>;
  /** Translation keys (namespace "app") of the problems in this row */
  errors: string[];
};

export type ReadResult = {
  rows: ImportRow[];
  /** Required columns not found in the header */
  missing: Column[];
};

/** Reads the CSV text: finds the columns by name and converts each row. */
export function readMetricsCsv(text: string): ReadResult {
  const [header = [], ...lines] = parseCsv(text);
  const names = header.map(normalize);
  const index = Object.fromEntries(
    (Object.keys(COLUMN_NAMES) as Column[]).map((column) => [
      column,
      names.findIndex((n) => COLUMN_NAMES[column].includes(n)),
    ]),
  ) as Record<Column, number>;
  const missing = REQUIRED.filter((c) => index[c] === -1);
  if (missing.length) return { rows: [], missing };

  const rows = lines.map((cells, i): ImportRow => {
    const cell = (c: Column) =>
      index[c] === -1 ? "" : (cells[index[c]] ?? "");
    const errors: string[] = [];
    const publishedOn = parseDate(cell("date"));
    if (!publishedOn) errors.push("metricsImport.errors.invalidDate");
    const values = {} as Record<MetricField, number>;
    for (const field of METRIC_FIELDS) {
      const n = parseCount(cell(field));
      if (n === null) {
        errors.push("metricsImport.errors.invalidNumber");
        values[field] = 0;
      } else {
        values[field] = n;
      }
    }
    return {
      line: i + 2,
      publishedOn,
      label: cell("post").trim(),
      values,
      errors: [...new Set(errors)],
    };
  });
  return { rows, missing };
}

/** A published variation that a row can be matched to. */
export type Candidate = { id: string; title: string; date: string | null };

/** The variation published that day, when there is exactly one. */
export function autoMatch(
  row: Pick<ImportRow, "publishedOn">,
  candidates: Candidate[],
): string | null {
  if (!row.publishedOn) return null;
  const sameDay = candidates.filter((c) => c.date === row.publishedOn);
  return sameDay.length === 1 ? sameDay[0].id : null;
}

/** Example CSV per network, with the column names the network uses. */
export function templateCsv(network: Rede): string {
  const headers: Record<Rede, string[]> = {
    linkedin: [
      "created date",
      "post title",
      "impressions",
      "reactions",
      "comments",
      "reposts",
      "clicks",
    ],
    instagram: [
      "publish time",
      "description",
      "views",
      "likes",
      "comments",
      "shares",
      "link clicks",
    ],
    x: [
      "time",
      "tweet text",
      "impressions",
      "likes",
      "replies",
      "reposts",
      "url clicks",
    ],
  };
  return toCsv([
    headers[network],
    ["2026-11-02", "5 erros ao migrar para a nuvem", 2720, 65, 13, 9, 22],
    ["2026-11-05", "Backup em nuvem sem complicação", "1.480", 31, 4, 2, 11],
  ]);
}

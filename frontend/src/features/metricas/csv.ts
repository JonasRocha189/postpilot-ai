// Minimal CSV reader for the networks' exports (no dependency): quoted fields
// (with "" as an escaped quote and line breaks inside quotes), and the
// separator detected from the header: comma, semicolon or tab.

const SEPARATORS = [",", ";", "\t"] as const;

/** The separator that appears most in the first line (outside quotes). */
function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (sep: string) => {
    let n = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === sep && !quoted) n++;
    }
    return n;
  };
  return [...SEPARATORS].sort((a, b) => count(b) - count(a))[0];
}

/** Rows of cells. Empty lines are skipped; a BOM at the start is removed. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const sep = detectSeparator(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      endCell();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}

/** CSV text from rows (quotes cells that need it). */
export function toCsv(rows: (string | number)[][]): string {
  const quote = (value: string | number) => {
    const s = String(value);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(quote).join(",")).join("\n") + "\n";
}

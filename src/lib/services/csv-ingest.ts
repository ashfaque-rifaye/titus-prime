/**
 * CSV ingest with LLM-powered schema inference.
 *
 * Real implementation:
 *   • zero-dep streaming CSV parser (handles quotes, escapes, CRLF)
 *   • lightweight type inference per column (number / date / bool / string)
 *   • optional LLM enrichment: ask Gemini what each column likely means in a
 *     financial-data context
 */
import { selectProvider } from "../llm";

export type InferredColumn = {
  name: string;
  type: "number" | "date" | "bool" | "string";
  /** Sampled values used to infer the type. */
  samples: string[];
  /** Optional human-readable description filled in by the LLM. */
  meaning?: string;
};

export type IngestResult = {
  rowCount: number;
  columns: InferredColumn[];
  /** First 5 rows for preview. */
  preview: Record<string, string>[];
  hash: string;
  bytes: number;
};

/** Streaming-friendly CSV parser. Handles quoted fields with embedded commas. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cur.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  const headers = rows.shift() ?? [];
  return { headers, rows };
}

const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const SLASH_DATE_RE = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/;
const BOOL_RE = /^(true|false|yes|no)$/i;

function inferType(samples: string[]): InferredColumn["type"] {
  const nonEmpty = samples.filter((s) => s != null && s !== "");
  if (nonEmpty.length === 0) return "string";
  let n = 0;
  let d = 0;
  let b = 0;
  for (const v of nonEmpty) {
    if (NUMBER_RE.test(v.replace(/[$,]/g, ""))) n++;
    else if (ISO_DATE_RE.test(v) || SLASH_DATE_RE.test(v)) d++;
    else if (BOOL_RE.test(v)) b++;
  }
  const total = nonEmpty.length;
  if (n / total >= 0.8) return "number";
  if (d / total >= 0.8) return "date";
  if (b / total >= 0.8) return "bool";
  return "string";
}

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** Pure parse + type inference. No network calls. */
export function ingest(text: string): IngestResult {
  const { headers, rows } = parseCsv(text);
  const columns: InferredColumn[] = headers.map((name, idx) => {
    const samples = rows.slice(0, 25).map((r) => r[idx] ?? "");
    return { name: name.trim(), type: inferType(samples), samples: samples.slice(0, 5) };
  });
  const preview: Record<string, string>[] = rows.slice(0, 5).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h.trim()] = r[i] ?? ""));
    return o;
  });
  return {
    rowCount: rows.length,
    columns,
    preview,
    hash: djb2(text),
    bytes: text.length,
  };
}

/** Optional LLM enrichment: ask Gemini what each column means. */
export async function enrichWithLlm(result: IngestResult): Promise<IngestResult> {
  const { provider } = selectProvider();
  if (!provider.isConfigured()) return result;

  const sample = result.columns
    .map((c) => `${c.name} (${c.type}): ${c.samples.join(", ")}`)
    .join("\n");
  const prompt = `You are inspecting a financial CSV uploaded to Titus-Prime. For each column,
output a single short phrase (4-8 words) describing what the column likely means
in a SaaS finance context.

Columns:
${sample}

Output JSON ONLY in the form:
{"<column_name>": "<short meaning>", ...}`;

  try {
    const raw = await provider.complete({
      messages: [
        { role: "system", content: "Return strict JSON. No prose." },
        { role: "user", content: prompt },
      ],
      maxTokens: 400,
      temperature: 0.1,
      trace: "csv.enrich",
    });
    const json = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
    return {
      ...result,
      columns: result.columns.map((c) => ({ ...c, meaning: json[c.name] })),
    };
  } catch {
    return result;
  }
}

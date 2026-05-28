/**
 * CsvUpload
 *
 * Drag-and-drop or click-to-pick. Streams the CSV bytes to /api/csv/ingest
 * which infers schemas and (when an LLM engine is reachable) annotates each
 * column with a short human-readable meaning.
 */
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

type IngestResult = {
  rowCount: number;
  bytes: number;
  hash: string;
  columns: Array<{ name: string; type: string; samples: string[]; meaning?: string }>;
  preview: Record<string, string>[];
};

export function CsvUpload({ onIngested }: { onIngested?: (r: IngestResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("Max 2MB CSV in this demo");
      return;
    }
    setBusy(true);
    setFilename(file.name);
    try {
      const text = await file.text();
      const resp = await fetch("/api/csv/ingest", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "ingest failed" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const json: IngestResult = await resp.json();
      setResult(json);
      onIngested?.(json);
      toast.success(
        `Ingested ${file.name} · ${json.rowCount} rows · ${json.columns.length} columns`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Ingest failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Drop financial data</h3>
        <span className="text-[11px] text-muted-foreground mono">CSV · ≤ 2MB</span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setHover(false);
          const f = e.dataTransfer.files?.[0];
          if (f) await handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          hover ? "border-primary/60 bg-primary/5" : "border-border bg-background/40 hover:border-primary/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div className="text-2xl">📄</div>
        <p className="mt-2 text-sm">
          {busy ? (
            <span className="text-muted-foreground">Inspecting <span className="mono">{filename}</span> …</span>
          ) : filename ? (
            <span><span className="mono accent-text">{filename}</span> ingested · drop another to replace</span>
          ) : (
            <span className="text-muted-foreground">
              Drop a Stripe export, bank CSV, or subscription tracker. Codex Prime infers the schema.
            </span>
          )}
        </p>
      </div>
      <AnimatePresence>
        {result && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 space-y-2"
          >
            <div className="text-[11px] mono text-muted-foreground">
              {result.rowCount} rows · {result.bytes.toLocaleString()} bytes · hash {result.hash}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {result.columns.map((c) => (
                <motion.div
                  key={c.name}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-md border border-border bg-background/60 px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-[12px] text-foreground truncate">{c.name}</span>
                    <span className="text-[10px] mono accent-text uppercase">{c.type}</span>
                  </div>
                  {c.meaning && <div className="text-[11px] text-muted-foreground mt-0.5">{c.meaning}</div>}
                  {!c.meaning && (
                    <div className="text-[10.5px] text-muted-foreground mt-0.5 truncate mono">
                      e.g. {c.samples.slice(0, 3).join(" · ")}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

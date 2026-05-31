/**
 * WhatIfPanel — CFO-grade advisory on top of Scenario Modeler.
 *
 * "What if I hire 2 engineers in March?" → instant re-projected 30-day runway
 * with the delta vs. baseline. Turns the product from bookkeeping into decision
 * support — the layer a CFO actually pays for.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FlaskConical, ArrowRight, TrendingUp, TrendingDown, Sparkles } from "lucide-react";

type WhatIfResult = {
  baselineEndUsd: number;
  scenarioEndUsd: number;
  deltaUsd: number;
  baselineRunwayDays: number | null;
  scenarioRunwayDays: number | null;
  monthlyBurnDeltaUsd: number;
  narrative: string;
};

const PRESETS = [
  { label: "Hire 2 engineers", body: { hires: 2 } },
  { label: "Lose biggest customer", body: { lostCustomer: "" } }, // resolved server-side by name match; empty = top
  { label: "+$10k MRR", body: { extraMrrUsd: 10000 } },
  { label: "$50k one-off", body: { oneOffExpenseUsd: 50000 } },
];

function usd(n: number): string {
  const s = Math.round(Math.abs(n)).toLocaleString("en-US");
  return `${n < 0 ? "-" : ""}$${s}`;
}
function runway(d: number | null): string {
  return d === null ? "12+ mo" : `${d} days`;
}

export function WhatIfPanel() {
  const [hires, setHires] = useState("");
  const [lost, setLost] = useState("");
  const [oneOff, setOneOff] = useState("");
  const [mrr, setMrr] = useState("");
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(body?: Record<string, unknown>) {
    setLoading(true);
    try {
      const payload = body ?? {
        hires: hires ? Number(hires) : undefined,
        lostCustomer: lost || undefined,
        oneOffExpenseUsd: oneOff ? Number(oneOff) : undefined,
        extraMrrUsd: mrr ? Number(mrr) : undefined,
      };
      const r = await fetch("/api/value/whatif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setResult(await r.json());
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }

  const improved = (result?.deltaUsd ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-border bg-surface/60 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-background/40">
        <FlaskConical className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">What-if Simulator</h3>
        <span className="text-[10px] mono text-muted-foreground">Scenario Modeler · advisory</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Preset chips */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => run(p.body)}
              disabled={loading}
              className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Manual inputs */}
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Hires" value={hires} onChange={setHires} placeholder="2" />
          <LabeledInput
            label="Lose customer"
            value={lost}
            onChange={setLost}
            placeholder="Acme"
            text
          />
          <LabeledInput label="One-off $" value={oneOff} onChange={setOneOff} placeholder="50000" />
          <LabeledInput label="Extra MRR $" value={mrr} onChange={setMrr} placeholder="10000" />
        </div>

        <button
          onClick={() => run()}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Modeling…" : "Simulate"} <ArrowRight className="h-3.5 w-3.5" />
        </button>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-lg border p-3 ${improved ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}
            >
              <div className="flex items-center gap-1.5 text-[11px] mono uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Projection
              </div>
              <p className="mt-1 text-sm text-foreground">{result.narrative}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Metric label="Baseline EoM" value={usd(result.baselineEndUsd)} />
                <Metric
                  label="Scenario EoM"
                  value={usd(result.scenarioEndUsd)}
                  tone={improved ? "good" : "bad"}
                />
                <Metric
                  label="Delta"
                  value={usd(result.deltaUsd)}
                  tone={improved ? "good" : "bad"}
                  icon={improved ? TrendingUp : TrendingDown}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>
                  Runway:{" "}
                  <span className="text-foreground">{runway(result.baselineRunwayDays)}</span> →{" "}
                  <span className={improved ? "text-emerald-300" : "text-rose-300"}>
                    {runway(result.scenarioRunwayDays)}
                  </span>
                </span>
                <span>Burn Δ {usd(result.monthlyBurnDeltaUsd)}/mo</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  text,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  text?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={text ? "text" : "number"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
      />
    </label>
  );
}

function Metric({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  icon?: React.ElementType;
}) {
  const color =
    tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="text-[9px] mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular-nums inline-flex items-center gap-1 ${color}`}
      >
        {Icon && <Icon className="h-3 w-3" />}
        {value}
      </div>
    </div>
  );
}

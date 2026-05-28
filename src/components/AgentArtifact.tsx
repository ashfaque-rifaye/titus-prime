/**
 * AgentArtifact — the human-readable provenance card per agent.
 *
 * Replaces the "click to see Python" experience. Each agent has its own
 * artifact shape:
 *   • Collection      → editable email template + customer list
 *   • Subscription    → renewal calendar with cancel-now / keep
 *   • Tax             → pre-filled return preview with line items
 *   • Treasury        → editable assumption knobs (payroll date, floor, etc.)
 *   • Scenario        → 3 ranked plan cards
 *
 * Every artifact has a "View technical detail" disclosure at the bottom that
 * reveals the underlying Python skill (kept as audit trail; not the headline).
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Calendar, FileText, Sliders, Trophy, Code2, ChevronDown } from "lucide-react";
import type { SkillTemplate } from "@/lib/skill-templates";

export type ArtifactKind = "collection" | "subscription" | "tax" | "treasury" | "scenario";

type Props = {
  kind: ArtifactKind;
  title: string;
  /** Optional underlying Python skill (audit trail only) */
  skill?: SkillTemplate;
  data: any;
  onCustomize?: (instruction: string) => Promise<void>;
};

export function AgentArtifact({ kind, title, skill, data, onCustomize }: Props) {
  const [showCode, setShowCode] = useState(false);
  const [customInstr, setCustomInstr] = useState("");
  const [customizing, setCustomizing] = useState(false);

  const Icon =
    kind === "collection" ? Mail :
    kind === "subscription" ? Calendar :
    kind === "tax" ? FileText :
    kind === "treasury" ? Sliders :
    Trophy;

  return (
    <div className="rounded-xl border border-border bg-surface/60 backdrop-blur overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/40">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 accent-text" />
          <span className="text-xs font-semibold">{title}</span>
        </div>
        <span className="text-[10px] mono text-muted-foreground capitalize">{kind} artifact</span>
      </div>

      <div className="p-4">
        {kind === "collection" && <CollectionView data={data} />}
        {kind === "subscription" && <SubscriptionView data={data} />}
        {kind === "tax" && <TaxView data={data} />}
        {kind === "treasury" && <TreasuryView data={data} />}
        {kind === "scenario" && <ScenarioView data={data} />}

        {/* Customize prompt */}
        {onCustomize && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="text-[10px] mono uppercase tracking-wide text-muted-foreground mb-1.5">
              Customize this agent's behavior
            </div>
            <div className="flex gap-2">
              <input
                value={customInstr}
                onChange={(e) => setCustomInstr(e.target.value)}
                placeholder="e.g. soften the tone for enterprise customers, add VAT to filings…"
                className="flex-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              <button
                onClick={async () => {
                  if (!customInstr.trim() || customizing) return;
                  setCustomizing(true);
                  try {
                    await onCustomize(customInstr);
                    setCustomInstr("");
                  } finally {
                    setCustomizing(false);
                  }
                }}
                disabled={!customInstr.trim() || customizing}
                className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition shrink-0"
              >
                {customizing ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        )}

        {/* Technical detail disclosure */}
        {skill && (
          <div className="mt-4 pt-3 border-t border-border">
            <button
              onClick={() => setShowCode((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
            >
              <Code2 className="h-3 w-3" />
              <span>{showCode ? "Hide" : "Show"} technical detail</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showCode ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showCode && (
                <motion.pre
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mono mt-2 overflow-auto rounded-md border border-border bg-background/60 p-3 text-[11px] leading-relaxed scrollbar-thin max-h-72"
                >
                  <code className="text-foreground/80">{skill.code}</code>
                </motion.pre>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────  per-kind views  ──────────────────────────── */

function CollectionView({ data }: { data: any }) {
  const tone: "friendly" | "firm" = data?.tone ?? "friendly";
  const inv = data?.invoice ?? { customer: "Acme Robotics", amount: 8200, daysLate: 14, id: "INV-1042" };
  const body =
    tone === "firm"
      ? `Hi ${firstName(inv.customer)},\n\nInvoice ${inv.id} ($${inv.amount.toLocaleString()}) is now ${inv.daysLate} days overdue. Please remit by end of week, or reach out today to arrange a payment plan.\n\nThanks,\nAlex`
      : `Hi ${firstName(inv.customer)},\n\nHope all's well at ${inv.customer}. Just a quick nudge — Invoice ${inv.id} for $${inv.amount.toLocaleString()} (issued ${inv.daysLate + 30}d ago) is now ${inv.daysLate} days past the Net-30 term. Could you check with your AP team when we can expect payment?\n\nHappy to jump on a call if helpful.\n\nBest,\nAlex`;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] mono">
        <span className="text-muted-foreground">To:</span>
        <span className="text-foreground">{inv.customer}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Tone:</span>
        <span className={`px-1.5 py-px rounded ${tone === "firm" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
          {tone}
        </span>
      </div>
      <pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-background/60 p-3 leading-relaxed">{body}</pre>
      <div className="flex items-center justify-between text-[11px] mono">
        <span className="text-muted-foreground">{inv.id} · ${inv.amount.toLocaleString()} · {inv.daysLate}d late</span>
        <button className="rounded-md bg-primary/15 hover:bg-primary/25 accent-text border border-primary/30 px-2 py-1">
          Approve & queue
        </button>
      </div>
    </div>
  );
}

function SubscriptionView({ data }: { data: any }) {
  const subs = data?.subscriptions ?? [];
  return (
    <div className="space-y-2">
      {subs.map((s: any) => (
        <div key={s.id ?? s.vendor} className="rounded-lg border border-border bg-background/60 p-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{s.vendor}</div>
            <div className="text-[10px] mono text-muted-foreground">
              ${s.monthlyCost}/mo · renews in {s.renewsIn}d · cancel window closes in {s.cancelWindowClosesIn}d
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button className="text-[10px] mono rounded border border-rose-500/40 bg-rose-500/10 text-rose-300 px-2 py-1 hover:bg-rose-500/20 transition">
              Cancel
            </button>
            <button className="text-[10px] mono rounded border border-border bg-background/40 text-muted-foreground px-2 py-1 hover:text-foreground transition">
              Keep
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TaxView({ data }: { data: any }) {
  const states = data?.states ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {states.map((s: any) => (
          <div
            key={s.state}
            className={`rounded-lg border p-2.5 ${s.nexusCrossed ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-background/40"}`}
          >
            <div className="text-[10px] mono uppercase text-muted-foreground">{s.state}</div>
            <div className="text-xs font-semibold mt-0.5">${s.revenueYTD.toLocaleString()}</div>
            <div className={`text-[10px] mono mt-0.5 ${s.nexusCrossed ? "text-rose-300" : "text-muted-foreground"}`}>
              {s.nexusCrossed ? `Owes $${s.taxOwed.toFixed(2)}` : `${Math.round((s.revenueYTD / (s.threshold || 1)) * 100)}% of threshold`}
            </div>
          </div>
        ))}
      </div>
      {data?.preFilled && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
          <div className="text-[10px] mono uppercase tracking-wider text-rose-300 mb-1">Pre-filled return preview</div>
          <div className="text-xs">
            {data.preFilled.state} · {data.preFilled.period} · taxable base ${data.preFilled.base.toLocaleString()} × {(data.preFilled.rate * 100).toFixed(2)}% = ${data.preFilled.owed.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{data.preFilled.citation}</div>
        </div>
      )}
    </div>
  );
}

function TreasuryView({ data }: { data: any }) {
  const k = data?.assumptions ?? { floor: 5000, payrollDay: 15, payrollAmount: 22000, recoveryPct: 50 };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Knob label="Safety floor" value={`$${k.floor.toLocaleString()}`} />
      <Knob label="Payroll day" value={`Day ${k.payrollDay}`} />
      <Knob label="Payroll amount" value={`$${k.payrollAmount.toLocaleString()}`} />
      <Knob label="AR recovery rate" value={`${k.recoveryPct}%`} />
    </div>
  );
}

function ScenarioView({ data }: { data: any }) {
  const plans = data?.plans ?? [];
  return (
    <div className="space-y-2">
      {plans.map((p: any, i: number) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-background/40 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold">{p.name}</div>
            <span className="text-[10px] mono accent-text">{p.successPct}%</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{p.rationale}</div>
          <div className="mt-2 flex items-center gap-2 text-[10px] mono">
            <span className="text-muted-foreground">Buffer gain</span>
            <span className="text-emerald-300">+${p.bufferGain?.toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Knob({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/60 px-3 py-2">
      <div className="text-[10px] mono uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mono mt-0.5">{value}</div>
    </div>
  );
}

function firstName(full: string): string {
  return full.split(/\s|,/)[0];
}

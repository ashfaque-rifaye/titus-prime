import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/policy")({
  head: () => ({
    meta: [
      { title: "Policy Envelope · Titus-Prime" },
      {
        name: "description",
        content: "Tunable trust boundary that decides when Titus-Prime acts vs. asks.",
      },
    ],
  }),
  component: PolicyPage,
});

type Policy = {
  approve_email_above_usd: number;
  approve_payment_above_usd: number;
  approve_subscription_change: boolean;
  approve_tax_filing: boolean;
  pause_all: boolean;
};

const DEFAULT_POLICY: Policy = {
  approve_email_above_usd: 1000,
  approve_payment_above_usd: 500,
  approve_subscription_change: true,
  approve_tax_filing: true,
  pause_all: false,
};

function toYaml(p: Policy): string {
  return Object.entries(p)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}
function fromYaml(s: string): Policy {
  const out: any = { ...DEFAULT_POLICY };
  for (const line of s.split("\n")) {
    const [k, ...rest] = line.split(":");
    if (!k || rest.length === 0) continue;
    const raw = rest.join(":").trim();
    if (raw === "true" || raw === "false") out[k.trim()] = raw === "true";
    else if (!isNaN(Number(raw))) out[k.trim()] = Number(raw);
  }
  return out as Policy;
}

function PolicyPage() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("policies").select("*").limit(1).maybeSingle();
    if (data) {
      setRowId(data.id);
      setPolicy(fromYaml(data.yaml_content));
      return;
    }
    const { data: inserted } = await supabase
      .from("policies")
      .insert({ yaml_content: toYaml(DEFAULT_POLICY) })
      .select()
      .single();
    if (inserted) {
      setRowId(inserted.id);
      setPolicy(DEFAULT_POLICY);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function update<K extends keyof Policy>(k: K, v: Policy[K]) {
    if (!policy || !rowId) return;
    const next = { ...policy, [k]: v };
    setPolicy(next);
    await supabase
      .from("policies")
      .update({ yaml_content: toYaml(next) })
      .eq("id", rowId);
    toast.success("Policy updated");
  }

  if (!policy)
    return (
      <div className="p-12 text-center text-muted-foreground text-sm">Loading policy envelope…</div>
    );

  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Policy Envelope</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The trust boundary. Inside the envelope, agents act autonomously. Outside, they queue for
        your approval.
      </p>
      <div className="mt-8 space-y-4">
        <Row
          title="Auto-send collection emails up to"
          desc="Above this invoice amount, the email is queued for your approval first."
          control={
            <NumberField
              value={policy.approve_email_above_usd}
              onChange={(v) => update("approve_email_above_usd", v)}
              prefix="$"
            />
          }
        />
        <Row
          title="Auto-pay vendors up to"
          desc="Above this amount, payment requires explicit approval."
          control={
            <NumberField
              value={policy.approve_payment_above_usd}
              onChange={(v) => update("approve_payment_above_usd", v)}
              prefix="$"
            />
          }
        />
        <Toggle
          title="Subscription changes need approval"
          desc="Cancels, pauses, downgrades."
          value={policy.approve_subscription_change}
          onChange={(v) => update("approve_subscription_change", v)}
        />
        <Toggle
          title="Tax filings need approval"
          desc="Returns, registrations, remittances — always."
          value={policy.approve_tax_filing}
          onChange={(v) => update("approve_tax_filing", v)}
        />
        <Toggle
          title="Pause all autonomous actions"
          desc="Big red button. Agents observe only."
          value={policy.pause_all}
          onChange={(v) => update("pause_all", v)}
          danger
        />
      </div>
    </div>
  );
}

function Row({ title, desc, control }: { title: string; desc: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface/60 p-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
function NumberField({
  value,
  onChange,
  prefix,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
}) {
  return (
    <div className="flex items-center rounded-md border border-border bg-background overflow-hidden">
      {prefix && <span className="px-2 text-xs text-muted-foreground">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 bg-transparent px-2 py-1.5 text-sm focus:outline-none"
      />
    </div>
  );
}
function Toggle({
  title,
  desc,
  value,
  onChange,
  danger,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border ${danger && value ? "border-rose-400/50" : "border-border"} bg-surface/60 p-4`}
    >
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? (danger ? "bg-rose-500" : "bg-primary") : "bg-secondary"}`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${value ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

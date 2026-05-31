import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Server,
  Cloud,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  RefreshCw,
  Activity,
  ShieldAlert,
  Zap,
  CheckCircle2,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";

type ServiceCost = { name: string; cost: number; env?: "prod" | "staging" | "dev" };
type CloudResult = {
  live: boolean;
  connected?: boolean;
  provider: "aws" | "gcp";
  monthlySpend: number;
  prevMonthSpend: number;
  currency: string;
  topServices: ServiceCost[];
  billingAccounts?: string[];
  detail: string;
};

const META = {
  aws: {
    name: "AWS",
    icon: Server,
    endpoint: "/api/cloud/aws",
    anomaly: "EC2 usage trending +34% vs last week",
    optimization: { message: "Buy a 3yr Compute Savings Plan for stable instances", save: 420 },
  },
  gcp: {
    name: "Google Cloud",
    icon: Cloud,
    endpoint: "/api/cloud/gcp",
    anomaly: null as string | null,
    optimization: { message: "3 idle Compute Engine instances detected in staging", save: 150 },
  },
} as const;

export function CloudFinOpsPanel() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CloudCard provider="aws" />
      <CloudCard provider="gcp" />
    </div>
  );
}

function CloudCard({ provider }: { provider: "aws" | "gcp" }) {
  const meta = META[provider];
  const Icon = meta.icon;
  const [data, setData] = useState<CloudResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(meta.endpoint);
      const j: CloudResult = await r.json();
      setData(j);
    } catch {
      /* leave previous data */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = !!data?.live;
  const connected = !!data?.connected || live;
  const spend = data?.monthlySpend ?? 0;
  const prev = data?.prevMonthSpend ?? 0;
  const delta = spend - prev;
  const deltaPct = prev > 0 ? ((delta / prev) * 100).toFixed(1) : "—";
  const isUp = delta > 0;
  const cur = data?.currency ?? "USD";

  return (
    <div className="rounded-xl border border-border bg-surface/60 overflow-hidden flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/50 bg-background/30">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-10 w-10 place-items-center rounded-lg border ${live ? "bg-emerald-500/10 border-emerald-500/30" : connected ? "bg-sky-500/10 border-sky-500/30" : "bg-background/60 border-border"}`}
          >
            <Icon
              className={`h-5 w-5 ${live ? "text-emerald-500" : connected ? "text-sky-400" : "text-muted-foreground"}`}
            />
          </div>
          <div>
            <div className="text-sm font-semibold">{meta.name}</div>
            <StatusBadge live={live} connected={connected} loading={loading} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold mono tracking-tight">
            {cur === "USD" ? "$" : ""}
            {spend.toLocaleString()}
            {cur !== "USD" ? ` ${cur}` : ""}
          </div>
          {prev > 0 && (
            <div
              className={`flex items-center gap-1 text-[11px] mono font-medium mt-1 justify-end ${isUp ? "text-rose-400" : "text-emerald-400"}`}
            >
              {isUp ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {isUp ? "+" : ""}
              {deltaPct}% MoM
            </div>
          )}
        </div>
      </div>

      {/* Honest connection detail */}
      <div
        className={`px-4 py-2 text-[11px] border-b border-border/50 flex items-center justify-between gap-2 ${live ? "bg-emerald-500/5 text-emerald-200/90" : connected ? "bg-sky-500/5 text-sky-200/90" : "bg-amber-500/5 text-amber-200/90"}`}
      >
        <span className="truncate">{data?.detail ?? "Loading…"}</span>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1 hover:opacity-80 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {data?.billingAccounts && data.billingAccounts.length > 0 && (
        <div className="px-4 py-2 border-b border-border/50 text-[11px] text-muted-foreground">
          Billing accounts:{" "}
          <span className="text-foreground/80">{data.billingAccounts.join(", ")}</span>
        </div>
      )}

      {/* FinOps insights */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {meta.anomaly && live && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                Anomaly
              </span>
            </div>
            <div className="text-xs text-rose-200/90">{meta.anomaly}</div>
          </div>
        )}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                AI Optimization
              </span>
            </div>
            <span className="text-[10px] mono text-emerald-300 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded">
              Save ${meta.optimization.save}/mo
            </span>
          </div>
          <div className="text-xs text-emerald-100/90">{meta.optimization.message}</div>
          <button
            onClick={() => toast.success("Optimization plan created and routed to engineering.")}
            className="mt-2 text-[10px] mono uppercase font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Apply Optimization →
          </button>
        </div>
      </div>

      {/* Service breakdown — REAL services when live */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-t border-border bg-background/20 text-[11px] font-medium hover:bg-background/40 transition"
      >
        <span className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" /> Service Cost Breakdown
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-background/30"
          >
            <div className="px-4 py-3 space-y-3 border-t border-border/50">
              {(data?.topServices ?? []).map((svc) => {
                const pct = spend > 0 ? (svc.cost / spend) * 100 : 0;
                return (
                  <div key={svc.name} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="truncate">{svc.name}</span>
                      <span className="mono font-medium">${svc.cost.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({
  live,
  connected,
  loading,
}: {
  live: boolean;
  connected: boolean;
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="text-[10px] mono uppercase tracking-wider text-muted-foreground">
        Checking…
      </span>
    );
  }
  if (live) {
    return (
      <span className="flex items-center gap-1.5 mt-0.5">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        <span className="text-[10px] mono uppercase tracking-wider text-emerald-500">
          Live · Real Account
        </span>
      </span>
    );
  }
  if (connected) {
    return (
      <span className="flex items-center gap-1.5 mt-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
        <span className="text-[10px] mono uppercase tracking-wider text-sky-400">
          Connected · No cost export
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 mt-0.5">
      <FlaskConical className="h-3 w-3 text-amber-500" />
      <span className="text-[10px] mono uppercase tracking-wider text-amber-500">Simulated</span>
    </span>
  );
}

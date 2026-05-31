/**
 * CloudCostCards — AWS and GCP cost summary for the Boardroom.
 *
 * Shows monthly spend, top services, month-over-month trend,
 * and anomaly flags. Data is mock for demo; would connect to
 * real AWS Cost Explorer / GCP Billing APIs via connectors.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Server,
  Cloud,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type CloudProvider = {
  id: string;
  name: string;
  icon: React.ElementType;
  monthlySpend: number;
  prevMonthSpend: number;
  topServices: { name: string; cost: number }[];
  anomaly?: { message: string; delta: number };
  connectorStatus: "connected" | "pending";
};

const CLOUD_DATA: CloudProvider[] = [
  {
    id: "aws",
    name: "AWS",
    icon: Server,
    monthlySpend: 3_842,
    prevMonthSpend: 3_510,
    topServices: [
      { name: "EC2 Reserved", cost: 1_680 },
      { name: "S3 Storage", cost: 420 },
      { name: "RDS Aurora", cost: 890 },
      { name: "Lambda", cost: 210 },
    ],
    anomaly: { message: "EC2 spot usage +34% vs last week", delta: 34 },
    connectorStatus: "connected",
  },
  {
    id: "gcp",
    name: "Google Cloud",
    icon: Cloud,
    monthlySpend: 1_290,
    prevMonthSpend: 1_180,
    topServices: [
      { name: "Compute Engine", cost: 480 },
      { name: "BigQuery", cost: 310 },
      { name: "Cloud Run", cost: 190 },
      { name: "Cloud Storage", cost: 120 },
    ],
    connectorStatus: "connected",
  },
];

export function CloudCostCards() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {CLOUD_DATA.map((provider) => (
        <CloudCard key={provider.id} provider={provider} />
      ))}
    </div>
  );
}

function CloudCard({ provider }: { provider: CloudProvider }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = provider.icon;
  const delta = provider.monthlySpend - provider.prevMonthSpend;
  const deltaPct = ((delta / provider.prevMonthSpend) * 100).toFixed(1);
  const isUp = delta > 0;

  return (
    <div className="rounded-xl border border-border bg-surface/60 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-background/60 border border-border">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-xs font-semibold">{provider.name}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] mono text-muted-foreground">
                {provider.connectorStatus}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${provider.connectorStatus === "connected" ? "bg-emerald-500" : "bg-amber-500"}`}
              />
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold mono">
            ${provider.monthlySpend.toLocaleString()}
          </div>
          <div
            className={`flex items-center gap-0.5 text-[10px] mono ${isUp ? "text-rose-300" : "text-emerald-300"}`}
          >
            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isUp ? "+" : ""}
            {deltaPct}% vs last month
          </div>
        </div>
      </div>

      {/* Anomaly alert */}
      {provider.anomaly && (
        <div className="mx-4 mb-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-200 truncate">{provider.anomaly.message}</span>
          </div>
          <button
            onClick={() => toast.info(`Investigation queued for ${provider.name} anomaly`)}
            className="text-[10px] mono rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2 py-0.5 hover:bg-amber-500/20 transition shrink-0"
          >
            Investigate
          </button>
        </div>
      )}

      {/* Top services (expandable) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 border-t border-border text-[11px] text-muted-foreground hover:text-foreground transition"
      >
        <span>Top services</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1.5">
              {provider.topServices.map((svc) => {
                const pct = (svc.cost / provider.monthlySpend) * 100;
                return (
                  <div key={svc.name} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-[11px]">
                        <span className="truncate">{svc.name}</span>
                        <span className="mono text-muted-foreground">
                          ${svc.cost.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
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

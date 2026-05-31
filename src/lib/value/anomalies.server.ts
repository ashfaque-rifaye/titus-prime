/**
 * Anomaly detection — the proactive "sentinel" layer.
 *
 * Scans the canonical snapshot for things a CFO would want flagged without
 * asking: late-payer churn signals, renewal traps, customer concentration, and
 * cash danger. Pure function of the snapshot — deterministic, no side effects.
 */
import type { CanonicalSnapshot } from "../connectors/types";

const SAFETY_FLOOR = 5_000;

export type Anomaly = {
  id: string;
  severity: "high" | "medium" | "low";
  kind: "spend_spike" | "late_payer" | "renewal_window" | "cash_floor" | "concentration";
  title: string;
  detail: string;
  amountUsd?: number;
  agent: string;
};

export function detectAnomalies(snap: CanonicalSnapshot): Anomaly[] {
  const out: Anomaly[] = [];

  // 1. Cash danger — total cash is thin relative to near-term obligations.
  const monthlyOut =
    snap.outflows.reduce((s, o) => s + o.amountUsd, 0) + snap.totals.monthlySubsUsd;
  if (snap.totals.cashUsd < monthlyOut * 0.5) {
    out.push({
      id: "cash_floor",
      severity: "high",
      kind: "cash_floor",
      title: "Cash is thin vs. upcoming obligations",
      detail: `$${Math.round(snap.totals.cashUsd).toLocaleString()} on hand against ~$${Math.round(monthlyOut).toLocaleString()} monthly outflow. Run a full sweep.`,
      amountUsd: snap.totals.cashUsd,
      agent: "treasury",
    });
  }

  // 2. Late payers — past 21 days, a likely churn/cash signal.
  for (const inv of snap.inflows) {
    if (inv.status === "paid") continue;
    if (inv.daysLate >= 21) {
      out.push({
        id: `late_${inv.id}`,
        severity: inv.daysLate >= 28 ? "high" : "medium",
        kind: "late_payer",
        title: `${inv.customer} is ${inv.daysLate} days late`,
        detail: `Invoice ${inv.id} for $${Math.round(inv.amountUsd).toLocaleString()} is well past terms — possible churn or cash-flow signal.`,
        amountUsd: inv.amountUsd,
        agent: "collection",
      });
    }
  }

  // 3. Renewals inside the cancel window (non-essential first).
  for (const sub of snap.subscriptions) {
    if (sub.cancelWindowClosesIn <= 5) {
      out.push({
        id: `renew_${sub.id}`,
        severity: sub.cancelWindowClosesIn <= 2 ? "high" : "medium",
        kind: "renewal_window",
        title: `${sub.vendor} renews in ${sub.cancelWindowClosesIn}d`,
        detail: `$${Math.round(sub.monthlyCostUsd).toLocaleString()}/mo${sub.essential ? "" : " · non-essential"} — cancel window closing.`,
        amountUsd: sub.annualCostUsd,
        agent: "subscription",
      });
    }
  }

  // 4. Customer concentration — one customer is too much of open AR.
  const openAr = snap.inflows.filter((i) => i.status !== "paid");
  const totalAr = openAr.reduce((s, i) => s + i.amountUsd, 0);
  for (const inv of openAr) {
    if (totalAr > 0 && inv.amountUsd / totalAr > 0.4) {
      out.push({
        id: `conc_${inv.id}`,
        severity: "medium",
        kind: "concentration",
        title: `${inv.customer} is ${Math.round((inv.amountUsd / totalAr) * 100)}% of open AR`,
        detail: `$${Math.round(inv.amountUsd).toLocaleString()} of $${Math.round(totalAr).toLocaleString()} outstanding rests on one customer — concentration risk.`,
        amountUsd: inv.amountUsd,
        agent: "treasury",
      });
    }
  }

  // Highest severity first.
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export { SAFETY_FLOOR };

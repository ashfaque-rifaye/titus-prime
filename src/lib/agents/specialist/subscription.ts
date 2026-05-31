/**
 * Subscription & Vendor Watchdog
 *
 * Scans the renewal calendar against alert windows. In crisis mode it suppresses
 * early-payment recommendations and instead surfaces non-essential subscriptions
 * that can be paused to free cash.
 */
import { bus } from "../event-bus";
import { runSkill } from "./codex-prime";
import { SUBSCRIPTIONS, VENDORS, type Subscription, type Vendor } from "../../mock-data";
import type { ProposedAction } from "../types";

export type SubscriptionFinding = {
  urgent: Subscription[];
  pausable: Subscription[];
  earlyPay: Vendor[];
  crisisMode: boolean;
  skillRef: { agent: string; name: string; version: number };
};

export async function runSubscription(args: {
  runId: string;
  mode: "stream" | "template";
  crisisMode: boolean;
}): Promise<SubscriptionFinding> {
  const { runId, mode, crisisMode } = args;

  bus.emit({
    kind: "agent.thought",
    runId,
    ts: Date.now(),
    agent: "subscription",
    severity: "info",
    text: crisisMode
      ? "Crisis mode — surfacing pausable subs, suppressing early-payment recs."
      : "Scanning renewal & cancellation windows; ranking optimization candidates.",
  });

  const codex = await runSkill({
    runId,
    from: "subscription",
    skillKey: "renewal_scan",
    intent: "Daily scan: renewals, cancel windows, price escalations, early-pay discounts.",
    mode,
  });

  const urgent = SUBSCRIPTIONS.filter((s) => s.cancelWindowClosesIn <= 7 && !s.essential);
  const pausable = SUBSCRIPTIONS.filter((s) => !s.essential && s.monthlyCost <= 300);
  const earlyPay = crisisMode ? [] : VENDORS.filter((v) => v.discountPct > 0 && v.daysLeft <= 10);

  if (urgent.length > 0) {
    bus.emit({
      kind: "agent.finding",
      runId,
      ts: Date.now(),
      agent: "subscription",
      severity: "alert",
      title: `${urgent.length} urgent renewal${urgent.length === 1 ? "" : "s"} closing`,
      detail: urgent
        .map((s) => `${s.vendor}: window closes in ${s.cancelWindowClosesIn}d`)
        .join(" · "),
      data: { vendors: urgent.map((s) => s.vendor) },
    });
  }
  if (crisisMode && pausable.length > 0) {
    bus.emit({
      kind: "agent.finding",
      runId,
      ts: Date.now(),
      agent: "subscription",
      severity: "warn",
      title: `${pausable.length} non-essential subs are pausable`,
      detail: pausable.map((s) => `${s.vendor} · $${s.monthlyCost}/mo`).join(" · "),
    });
  }

  return {
    urgent,
    pausable,
    earlyPay,
    crisisMode,
    skillRef: { agent: codex.skill.agent, name: codex.skill.name, version: codex.skill.version },
  };
}

export function buildSubscriptionActions(finding: SubscriptionFinding): ProposedAction[] {
  const acts: ProposedAction[] = [];
  for (const s of finding.urgent) {
    acts.push({
      agent: "subscription",
      type: "cancel_subscription",
      title: `Cancel ${s.vendor} · saves $${s.annualCost.toLocaleString()}/yr`,
      body: `Cancel window closes in ${s.cancelWindowClosesIn} days. ${s.notes ?? ""}`.trim(),
      amountUsd: s.annualCost,
      metadata: { subId: s.id },
    });
  }
  if (finding.crisisMode) {
    for (const s of finding.pausable) {
      acts.push({
        agent: "subscription",
        type: "pause_subscription",
        title: `Pause ${s.vendor} · $${s.monthlyCost}/mo`,
        body: "Crisis-mode pause to free monthly cash.",
        amountUsd: s.monthlyCost,
        metadata: { subId: s.id },
      });
    }
  }
  for (const v of finding.earlyPay) {
    acts.push({
      agent: "subscription",
      type: "pay_vendor",
      title: `Early-pay ${v.name} · save $${Math.round(v.amount * (v.discountPct / 100))}`,
      body: `${v.discountPct}% discount if paid within ${v.daysLeft} days.`,
      amountUsd: v.amount,
      metadata: { vendorId: v.id, discount: v.discountPct },
    });
  }
  return acts;
}

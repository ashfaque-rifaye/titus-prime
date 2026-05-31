/**
 * Snapshot → legacy-shape adapter.
 *
 * The existing specialist agents were written against the original
 * `mock-data.ts` shape (`INVOICES`, `SUBSCRIPTIONS`, `VENDORS`, etc.). This
 * adapter translates the new canonical snapshot into those shapes so the
 * agents keep working without a full rewrite. Over time agents will be
 * migrated to read the snapshot directly.
 */
import { getSnapshot, ensureSnapshot } from "./connectors/registry";
import type { CanonicalSnapshot } from "./connectors/types";
import type { Invoice, Subscription, Vendor, StateRevenue } from "./mock-data";
import { STATE_REVENUE as STATIC_STATE_REVENUE, PAYROLL } from "./mock-data";

/** Headline summary used by Treasury Sentinel and the Boardroom hero. */
export type ProjectionPoint = { day: number; balance: number; event?: string };

export type DerivedView = {
  bankBalanceUsd: number;
  bankBalances: { account: string; balance: number; currency: string; balanceUsd: number }[];
  invoices: Invoice[];
  subscriptions: Subscription[];
  vendors: Vendor[];
  stateRevenue: StateRevenue[];
  projection: ProjectionPoint[];
  payroll: typeof PAYROLL;
  totals: CanonicalSnapshot["totals"];
};

const SAFETY_FLOOR = 5_000;

export async function deriveView(): Promise<DerivedView> {
  const snap = await ensureSnapshot();
  return shape(snap);
}

export function deriveViewSync(): DerivedView {
  return shape(getSnapshot());
}

function shape(snap: CanonicalSnapshot): DerivedView {
  // Invoices (legacy shape uses USD amounts only; we surface the amountUsd)
  const invoices: Invoice[] = snap.inflows
    .filter((i) => i.status !== "paid")
    .map((i) => ({
      id: i.id.replace(/^[a-z]+_/, ""),
      customer: i.customer,
      amount: Math.round(i.amountUsd),
      issued: i.issuedAt.slice(0, 10),
      due: i.dueAt.slice(0, 10),
      daysLate: i.daysLate,
      status: i.daysLate >= 21 ? "very_late" : i.daysLate > 0 ? "late" : "current",
    }));

  // Subscriptions (legacy shape)
  const subscriptions: Subscription[] = snap.subscriptions.map((s) => ({
    id: s.id,
    vendor: s.vendor,
    annualCost: Math.round(s.annualCostUsd),
    monthlyCost: Math.round(s.monthlyCostUsd),
    renewsIn: s.renewsIn,
    cancelWindowClosesIn: s.cancelWindowClosesIn,
    essential: s.essential,
    notes: s.notes,
  }));

  // Vendors with early-pay potential — derive from outflows that aren't payroll/tax
  const vendors: Vendor[] = snap.outflows
    .filter((o) => o.kind === "vendor_bill")
    .slice(0, 4)
    .map((o, idx) => ({
      id: `v${idx + 1}`,
      name: o.vendor,
      amount: Math.round(o.amountUsd),
      netDays: 30,
      daysLeft: Math.max(0, Math.round((new Date(o.dueAt).getTime() - Date.now()) / 86400_000)),
      discountPct: idx === 0 ? 2 : 0,
    }));

  // State revenue — keep static for now (Tax Compliance demo)
  const stateRevenue = STATIC_STATE_REVENUE;

  // Build a 30-day projection from real banks + outflows + expected inflows
  const projection = projectCash(snap);

  return {
    bankBalanceUsd: Math.round(snap.totals.cashUsd),
    bankBalances: snap.banks.map((b) => ({
      account: b.account,
      balance: b.balance,
      currency: b.currency,
      balanceUsd: Math.round(b.balanceUsd),
    })),
    invoices,
    subscriptions,
    vendors,
    stateRevenue,
    projection,
    payroll: PAYROLL,
    totals: snap.totals,
  };
}

function projectCash(snap: CanonicalSnapshot): ProjectionPoint[] {
  let balance = snap.totals.cashUsd;
  const points: ProjectionPoint[] = [];
  const outflowsByDay = new Map<number, { amount: number; vendor: string }>();
  for (const o of snap.outflows) {
    const day = Math.max(0, Math.round((new Date(o.dueAt).getTime() - Date.now()) / 86400_000));
    const existing = outflowsByDay.get(day);
    outflowsByDay.set(day, {
      amount: (existing?.amount ?? 0) + o.amountUsd,
      vendor: existing ? "Multiple" : o.vendor,
    });
  }
  // Inflows: assume only 25% of overdue AR comes in on its own without
  // chasing. Late-payers stay late. The autopilot scenario is what *recovers*
  // the rest — that's the value Titus-Prime adds.
  const inflowsByDay = new Map<number, number>();
  for (const i of snap.inflows) {
    if (i.status === "paid") continue;
    const day = Math.max(
      0,
      Math.round((new Date(i.dueAt).getTime() - Date.now()) / 86400_000) + 14,
    );
    inflowsByDay.set(day, (inflowsByDay.get(day) ?? 0) + i.amountUsd * 0.25);
  }
  inflowsByDay.set(28, (inflowsByDay.get(28) ?? 0) + 8600);

  for (let d = 0; d <= 30; d++) {
    const out = outflowsByDay.get(d);
    const inflow = inflowsByDay.get(d) ?? 0;
    if (out) balance -= out.amount;
    balance += inflow;
    points.push({
      day: d,
      balance: Math.round(balance),
      event: out?.vendor,
    });
  }
  return points;
}

export { SAFETY_FLOOR };

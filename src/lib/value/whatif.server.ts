/**
 * What-if simulation — turns Scenario Modeler from reactive to advisory.
 *
 * Given the current snapshot and a hypothetical (hire N engineers, lose a
 * customer, a one-off expense, new MRR), re-project 30-day runway and report the
 * delta vs. baseline. Pure function — deterministic, no side effects.
 */
import type { CanonicalSnapshot } from "../connectors/types";

export type WhatIfInput = {
  hires?: number;
  avgSalaryUsd?: number;
  lostCustomer?: string;
  oneOffExpenseUsd?: number;
  extraMrrUsd?: number;
};

export type WhatIfResult = {
  baselineEndUsd: number;
  scenarioEndUsd: number;
  deltaUsd: number;
  baselineRunwayDays: number | null;
  scenarioRunwayDays: number | null;
  monthlyBurnDeltaUsd: number;
  narrative: string;
};

const SAFETY_FLOOR = 5_000;
const HORIZON = 30;

function projectEnding(startUsd: number, dailyNet: number, days = HORIZON): number {
  return Math.round(startUsd + dailyNet * days);
}

function runwayDays(startUsd: number, dailyNet: number): number | null {
  if (dailyNet >= 0) return null; // never runs out at this rate
  return Math.max(0, Math.floor((startUsd - SAFETY_FLOOR) / -dailyNet));
}

export function simulateWhatIf(snap: CanonicalSnapshot, input: WhatIfInput): WhatIfResult {
  const cash = snap.totals.cashUsd;
  const monthlyInflow = snap.inflows
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + i.amountUsd, 0);
  const monthlySubs = snap.totals.monthlySubsUsd;
  const monthlyOutflow = snap.outflows.reduce((s, o) => s + o.amountUsd, 0) + monthlySubs;
  const baselineDailyNet = (monthlyInflow - monthlyOutflow) / 30;

  let inflowAdj = 0;
  let outflowAdj = 0;
  const hires = input.hires ?? 0;
  const avgSalary = input.avgSalaryUsd ?? 150_000;
  if (hires) outflowAdj += (hires * avgSalary) / 12;
  if (input.extraMrrUsd) inflowAdj += input.extraMrrUsd;
  if (input.oneOffExpenseUsd) outflowAdj += input.oneOffExpenseUsd;
  if (input.lostCustomer) {
    const lost = snap.inflows.find((i) =>
      i.customer.toLowerCase().includes(input.lostCustomer!.toLowerCase()),
    );
    if (lost) inflowAdj -= lost.amountUsd;
  }

  const scenarioDailyNet = (monthlyInflow + inflowAdj - (monthlyOutflow + outflowAdj)) / 30;
  const baselineEndUsd = projectEnding(cash, baselineDailyNet);
  const scenarioEndUsd = projectEnding(cash, scenarioDailyNet);

  return {
    baselineEndUsd,
    scenarioEndUsd,
    deltaUsd: scenarioEndUsd - baselineEndUsd,
    baselineRunwayDays: runwayDays(cash, baselineDailyNet),
    scenarioRunwayDays: runwayDays(cash, scenarioDailyNet),
    monthlyBurnDeltaUsd: Math.round(outflowAdj - inflowAdj),
    narrative: buildNarrative(input, scenarioEndUsd - baselineEndUsd),
  };
}

function buildNarrative(input: WhatIfInput, delta: number): string {
  const parts: string[] = [];
  if (input.hires) parts.push(`hiring ${input.hires} engineer${input.hires > 1 ? "s" : ""}`);
  if (input.lostCustomer) parts.push(`losing ${input.lostCustomer}`);
  if (input.oneOffExpenseUsd) parts.push(`a $${input.oneOffExpenseUsd.toLocaleString()} one-off`);
  if (input.extraMrrUsd) parts.push(`+$${input.extraMrrUsd.toLocaleString()} MRR`);
  const change = parts.length ? parts.join(", ") : "no change";
  const dir = delta >= 0 ? "improves" : "reduces";
  return `Scenario (${change}) ${dir} your 30-day ending cash by $${Math.abs(Math.round(delta)).toLocaleString()}.`;
}

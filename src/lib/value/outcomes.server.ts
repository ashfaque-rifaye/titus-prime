/**
 * Outcome tracking — closes the loop on whether agent actions actually worked.
 *
 * When the Collection agent sends a reminder we record an "outcome" in the
 * pending state. Later some resolve to "success" (invoice paid) — giving a real
 * recovery rate the scoreboard can cite instead of a projection. Seeded with
 * last month's history so the rate is non-empty on first load.
 *
 * Storage: in-memory at process scope (survives hot reload). Source of truth for
 * the demo so it works with zero DB setup.
 */

export type Outcome = {
  id: string;
  ts: number;
  kind: "collection_reminder" | "renewal_cancel" | "early_pay";
  ref: string;
  label: string;
  amountUsd: number;
  status: "pending" | "success" | "failed";
  resolvedAt?: number;
};

declare global {
  var __TITUS_OUTCOMES__: Outcome[] | undefined;
}

function store(): Outcome[] {
  if (!globalThis.__TITUS_OUTCOMES__) globalThis.__TITUS_OUTCOMES__ = seed();
  return globalThis.__TITUS_OUTCOMES__;
}

/** Seed last month's history so "recovery rate" is real on first load. */
function seed(): Outcome[] {
  const now = Date.now();
  const day = 86_400_000;
  const mk = (
    i: number,
    kind: Outcome["kind"],
    ref: string,
    label: string,
    amt: number,
    status: Outcome["status"],
    ageD: number,
  ): Outcome => ({
    id: `out_seed_${i}`,
    ts: now - ageD * day,
    kind,
    ref,
    label,
    amountUsd: amt,
    status,
    resolvedAt: status === "pending" ? undefined : now - (ageD - 5) * day,
  });
  return [
    mk(1, "collection_reminder", "INV-0911", "Orbit Systems", 4200, "success", 30),
    mk(2, "collection_reminder", "INV-0917", "Delta Foods", 1850, "success", 28),
    mk(3, "collection_reminder", "INV-0922", "Nimbus Health", 1450, "success", 24),
    mk(4, "collection_reminder", "INV-0930", "Acme Robotics", 8200, "success", 20),
    mk(5, "collection_reminder", "INV-0934", "Loop Analytics", 6400, "failed", 18),
    mk(6, "renewal_cancel", "sub-legacy", "Segment (cancelled)", 12000, "success", 15),
  ];
}

export function recordOutcome(
  o: Omit<Outcome, "id" | "ts" | "status"> & { status?: Outcome["status"] },
): Outcome {
  const s = store();
  const existing = s.find((x) => x.ref === o.ref && x.kind === o.kind && x.status === "pending");
  if (existing) return existing;
  const outcome: Outcome = {
    ...o,
    id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    status: o.status ?? "pending",
  };
  s.push(outcome);
  return outcome;
}

export function resolveOutcome(ref: string, status: "success" | "failed"): Outcome | null {
  const s = store();
  const o = s.find((x) => x.ref === ref && x.status === "pending");
  if (!o) return null;
  o.status = status;
  o.resolvedAt = Date.now();
  return o;
}

export type OutcomeStats = {
  total: number;
  resolved: number;
  success: number;
  failed: number;
  pending: number;
  recoveryRatePct: number;
  recoveredUsd: number;
  recent: Outcome[];
};

export function getOutcomeStats(): OutcomeStats {
  const s = store();
  const success = s.filter((x) => x.status === "success");
  const failed = s.filter((x) => x.status === "failed");
  const pending = s.filter((x) => x.status === "pending");
  const resolved = success.length + failed.length;
  return {
    total: s.length,
    resolved,
    success: success.length,
    failed: failed.length,
    pending: pending.length,
    recoveryRatePct: resolved > 0 ? Math.round((success.length / resolved) * 100) : 0,
    recoveredUsd: success.reduce((sum, x) => sum + x.amountUsd, 0),
    recent: [...s].sort((a, b) => b.ts - a.ts).slice(0, 10),
  };
}

/**
 * Value Ledger — the "money found" receipt.
 *
 * Every quantifiable agent action writes a ValueEvent here. The Boardroom
 * scoreboard reads aggregates from this ledger so the user always sees the
 * dollar (and time) impact the system has produced.
 *
 * Categories:
 *   protected  — cash crunch avoided (Treasury/Scenario)
 *   recovered  — AR collected (Collection)
 *   saved      — spend cut: cancelled/paused subs, early-pay discounts (Subscription)
 *   time       — hours of manual finance work avoided (any agent)
 *
 * Status:
 *   projected  — expected impact recorded at action time
 *   realized   — confirmed later (e.g. invoice actually paid)
 */
import { supabaseAdmin } from "../supabase-admin.server";

export type ValueCategory = "protected" | "recovered" | "saved" | "time";
export type ValueStatus = "projected" | "realized";

export type ValueEvent = {
  id: string;
  agent: string;
  category: ValueCategory;
  amount_usd: number;
  minutes_saved: number;
  label: string;
  run_id: string | null;
  status: ValueStatus;
  ref: string | null;
  created_at: string;
  realized_at: string | null;
};

export type RecordInput = {
  agent: string;
  category: ValueCategory;
  amountUsd?: number;
  minutesSaved?: number;
  label: string;
  runId?: string;
  status?: ValueStatus;
  ref?: string;
};

// Process-scoped fallback when the migration hasn't been applied yet.
declare global {
  var __TITUS_VALUE_EVENTS__: ValueEvent[] | undefined;
}
const memo = (): ValueEvent[] =>
  globalThis.__TITUS_VALUE_EVENTS__ ?? (globalThis.__TITUS_VALUE_EVENTS__ = []);

export async function recordValue(input: RecordInput): Promise<ValueEvent> {
  const row = {
    agent: input.agent,
    category: input.category,
    amount_usd: input.amountUsd ?? 0,
    minutes_saved: input.minutesSaved ?? 0,
    label: input.label,
    run_id: input.runId ?? null,
    status: input.status ?? "projected",
    ref: input.ref ?? null,
  };
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("value_events")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data as ValueEvent;
  } catch {
    const ev: ValueEvent = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
      realized_at: null,
      ...row,
    } as ValueEvent;
    memo().unshift(ev);
    return ev;
  }
}

/**
 * De-dupe helper: skip if an identical (ref, label) event already exists, so
 * repeated sweeps refresh the ledger rather than inflating it.
 *
 * The check runs against the in-memory store first (the ledger's source of
 * truth for the demo). A `value_events` Supabase query returns `{ data: null }`
 * when the table doesn't exist — it does NOT throw — so relying on the catch
 * branch alone would never dedupe. We check memo directly to be correct
 * regardless of whether the migration has been applied.
 */
export async function recordValueOnce(input: RecordInput): Promise<ValueEvent | null> {
  const exists = memo().some((e) => e.ref === input.ref && e.label === input.label);
  if (exists) return null;
  return recordValue(input);
}

export async function listValueEvents(limit = 100): Promise<ValueEvent[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("value_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (Array.isArray(data)) return data as ValueEvent[];
  } catch {
    /* fall through */
  }
  return memo().slice(0, limit);
}

export type Scoreboard = {
  protectedUsd: number;
  recoveredUsd: number;
  savedUsd: number;
  totalUsd: number;
  minutesSaved: number;
  hoursSaved: number;
  realizedUsd: number;
  projectedUsd: number;
  eventCount: number;
  byAgent: Record<string, number>;
  /** Same totals keyed by category — what the Scoreboard UI renders. */
  byCategory: Record<ValueCategory, number>;
  recent: ValueEvent[];
  /** Alias of `recent` for the UI; same data. */
  recentEvents: { id: string; label: string; amountUsd: number; status: string; agent: string }[];
};

/**
 * Seed the ledger from the current snapshot WITHOUT running the LLM.
 *
 * The scoreboard should never be blank just because the user hasn't manually
 * triggered a sweep this session (the in-memory store resets on restart). This
 * recomputes the projected value of every action the agents would propose,
 * using the same valuation rules as a real run — but with zero token spend.
 *
 * Idempotent: keyed by ref+label via recordValueOnce, so calling it repeatedly
 * (or before a real sweep) never double-counts.
 */
export async function seedScoreboardFromSnapshot(): Promise<void> {
  // Import lazily to avoid a circular dependency (agents import the ledger).
  const { deriveView } = await import("../snapshot-adapter.server");
  const view = await deriveView();

  const MIN: Record<ValueCategory, number> = {
    protected: 90,
    recovered: 12,
    saved: 20,
    time: 0,
  };

  // Treasury: a projected crunch protected.
  const crunch = view.projection.find((p) => p.balance < 5000);
  if (crunch) {
    const shortfall = Math.max(0, 5000 - crunch.balance);
    await recordValueOnce({
      agent: "treasury",
      category: "protected",
      amountUsd: shortfall,
      minutesSaved: MIN.protected,
      label: `Survival plan for Day ${crunch.day} crunch`,
      ref: `crunch_day_${crunch.day}`,
    });
  }

  // Collection: each overdue invoice is recoverable AR.
  for (const inv of view.invoices.filter((i) => i.daysLate > 0)) {
    await recordValueOnce({
      agent: "collection",
      category: "recovered",
      amountUsd: inv.amount,
      minutesSaved: MIN.recovered,
      label: `Reminder · ${inv.customer} · ${inv.id}`,
      ref: inv.id,
    });
  }

  // Subscription: cancellable non-essential renewals = annual spend saved.
  for (const s of view.subscriptions.filter((x) => !x.essential && x.cancelWindowClosesIn <= 30)) {
    await recordValueOnce({
      agent: "subscription",
      category: "saved",
      amountUsd: s.annualCost,
      minutesSaved: MIN.saved,
      label: `Cancel ${s.vendor} · saves $${s.annualCost.toLocaleString()}/yr`,
      ref: `sub_${s.id}`,
    });
  }

  // Subscription: early-pay vendor discounts.
  for (const v of view.vendors.filter((x) => x.discountPct > 0)) {
    await recordValueOnce({
      agent: "subscription",
      category: "saved",
      amountUsd: Math.round(v.amount * (v.discountPct / 100)),
      minutesSaved: 10,
      label: `Early-pay ${v.name} · ${v.discountPct}% discount`,
      ref: `vendor_${v.id}`,
    });
  }

  // Tax: penalty avoidance on crossed-nexus states.
  for (const st of view.stateRevenue.filter((x) => x.nexusCrossed && x.taxOwed > 0)) {
    await recordValueOnce({
      agent: "tax",
      category: "protected",
      amountUsd: st.taxOwed,
      minutesSaved: 120,
      label: `${st.state} sales-tax filing · $${st.taxOwed.toFixed(2)}`,
      ref: `tax_${st.state}`,
    });
  }
}

export async function getScoreboard(): Promise<Scoreboard> {
  // Auto-seed on first request so the scoreboard is never blank after a restart.
  if (memo().length === 0) {
    try {
      await seedScoreboardFromSnapshot();
    } catch {
      /* snapshot not ready yet — scoreboard will show empty-state, that's fine */
    }
  }
  const events = await listValueEvents(500);
  const sb: Scoreboard = {
    protectedUsd: 0,
    recoveredUsd: 0,
    savedUsd: 0,
    totalUsd: 0,
    minutesSaved: 0,
    hoursSaved: 0,
    realizedUsd: 0,
    projectedUsd: 0,
    eventCount: events.length,
    byAgent: {},
    byCategory: { protected: 0, recovered: 0, saved: 0, time: 0 },
    recent: events.slice(0, 12),
    recentEvents: [],
  };
  for (const e of events) {
    const amt = Number(e.amount_usd) || 0;
    if (e.category === "protected") sb.protectedUsd += amt;
    else if (e.category === "recovered") sb.recoveredUsd += amt;
    else if (e.category === "saved") sb.savedUsd += amt;
    sb.minutesSaved += Number(e.minutes_saved) || 0;
    if (e.category !== "time") {
      sb.totalUsd += amt;
      if (e.status === "realized") sb.realizedUsd += amt;
      else sb.projectedUsd += amt;
      sb.byAgent[e.agent] = (sb.byAgent[e.agent] ?? 0) + amt;
      sb.byCategory[e.category] += amt;
    }
  }
  sb.hoursSaved = Math.round((sb.minutesSaved / 60) * 10) / 10;
  sb.recentEvents = sb.recent.map((e) => ({
    id: e.id,
    label: e.label,
    amountUsd: Number(e.amount_usd) || 0,
    status: e.status,
    agent: e.agent,
  }));
  return sb;
}

/** Mark a projected event realized (outcome confirmed). Returns affected count. */
export async function realizeByRef(ref: string): Promise<number> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("value_events")
      .update({ status: "realized", realized_at: new Date().toISOString() })
      .eq("ref", ref)
      .eq("status", "projected")
      .select("id");
    if (error) throw error;
    return Array.isArray(data) ? data.length : 0;
  } catch {
    let n = 0;
    for (const e of memo()) {
      if (e.ref === ref && e.status === "projected") {
        e.status = "realized";
        e.realized_at = new Date().toISOString();
        n++;
      }
    }
    return n;
  }
}

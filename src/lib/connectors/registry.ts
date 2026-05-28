/**
 * Connector Registry — the single fan-out point for all integrations.
 *
 * Provides:
 *   - listAll()      : all known connectors with their config status
 *   - syncAll()      : invoke every connector in parallel, merge into a
 *                      canonical snapshot, persist to in-memory store
 *   - getSnapshot()  : current canonical state for UI/agents
 *
 * The store lives at process scope (globalThis) so hot reload preserves it.
 */
import type {
  Connector,
  CanonicalSnapshot,
  SyncResult,
  ConnectorId,
} from "./types";
import { StripeConnector } from "./stripe";
import { PlaidConnector } from "./plaid";
import { SalesforceConnector } from "./salesforce";
import {
  QuickBooksConnector,
  TallyConnector,
  ZohoBooksConnector,
  RazorpayConnector,
} from "./quickbooks";
import {
  GmailConnector,
  OutlookConnector,
  SlackConnector,
  TeamsConnector,
} from "./saas-trackers";

const REGISTRY: Connector[] = [
  new StripeConnector(),
  new PlaidConnector(),
  new SalesforceConnector(),
  new QuickBooksConnector(),
  new GmailConnector(),
  new OutlookConnector(),
  new SlackConnector(),
  new TeamsConnector(),
  new RazorpayConnector(),
  new TallyConnector(),
  new ZohoBooksConnector(),
];

declare global {
  // eslint-disable-next-line no-var
  var __TITUS_SNAPSHOT__: CanonicalSnapshot | undefined;
  // eslint-disable-next-line no-var
  var __TITUS_LAST_SYNC__: Record<string, number> | undefined;
}

function emptySnapshot(): CanonicalSnapshot {
  return {
    inflows: [],
    outflows: [],
    subscriptions: [],
    banks: [],
    totals: { cashUsd: 0, arUsd: 0, apUsd: 0, monthlySubsUsd: 0 },
  };
}

export function getSnapshot(): CanonicalSnapshot {
  return globalThis.__TITUS_SNAPSHOT__ ?? emptySnapshot();
}

export function listConnectors() {
  return REGISTRY.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    category: c.category,
    icon: c.icon,
    description: c.description,
    regions: c.regions,
    real: c.isReal(),
    configured: c.isConfigured(),
    lastSync: globalThis.__TITUS_LAST_SYNC__?.[c.id] ?? null,
  }));
}

export type SyncReport = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  results: SyncResult[];
  snapshot: CanonicalSnapshot;
};

export async function syncAll(opts?: {
  only?: ConnectorId[];
}): Promise<SyncReport> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const subset = opts?.only ? REGISTRY.filter((c) => opts.only!.includes(c.id)) : REGISTRY;

  const settled = await Promise.allSettled(
    subset.map(async (c) => {
      const start = Date.now();
      try {
        const out = await c.sync();
        const items =
          out.inflows.length + out.outflows.length + out.subscriptions.length + out.banks.length;
        return {
          connector: c.id,
          ok: true,
          durationMs: Date.now() - start,
          itemsIngested: items,
          detail: c.isReal()
            ? `${c.displayName} (real sandbox) · ${items} items`
            : `${c.displayName} (deterministic) · ${items} items`,
          payload: out,
        };
      } catch (e: any) {
        return {
          connector: c.id,
          ok: false,
          durationMs: Date.now() - start,
          itemsIngested: 0,
          detail: `${c.displayName} sync failed`,
          error: e?.message ?? "unknown",
          payload: null,
        };
      }
    }),
  );

  const results: SyncResult[] = [];
  const snap = emptySnapshot();
  const lastSync = globalThis.__TITUS_LAST_SYNC__ ?? {};

  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const v = s.value;
    results.push({
      connector: v.connector,
      ok: v.ok,
      durationMs: v.durationMs,
      itemsIngested: v.itemsIngested,
      detail: v.detail,
      error: v.error,
    });
    if (v.ok && v.payload) {
      snap.inflows.push(...v.payload.inflows);
      snap.outflows.push(...v.payload.outflows);
      snap.subscriptions.push(...v.payload.subscriptions);
      snap.banks.push(...v.payload.banks);
      lastSync[v.connector] = Date.now();
    }
  }

  // Compute totals (USD)
  snap.totals.cashUsd = snap.banks.reduce((s, b) => s + b.balanceUsd, 0);
  snap.totals.arUsd = snap.inflows
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + i.amountUsd, 0);
  snap.totals.apUsd = snap.outflows.reduce((s, o) => s + o.amountUsd, 0);
  snap.totals.monthlySubsUsd = snap.subscriptions.reduce((s, x) => s + x.monthlyCostUsd, 0);

  globalThis.__TITUS_SNAPSHOT__ = snap;
  globalThis.__TITUS_LAST_SYNC__ = lastSync;

  const endedAt = new Date().toISOString();
  return {
    startedAt,
    endedAt,
    durationMs: Date.now() - t0,
    results,
    snapshot: snap,
  };
}

/** Synchronous helper that ensures a snapshot exists (used by agents). */
export async function ensureSnapshot(): Promise<CanonicalSnapshot> {
  const cur = getSnapshot();
  if (cur.banks.length === 0 && cur.inflows.length === 0) {
    const r = await syncAll();
    return r.snapshot;
  }
  return cur;
}

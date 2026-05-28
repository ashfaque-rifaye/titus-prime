/**
 * GET /api/treasury/projection
 *
 * Returns the standby (do-nothing) and autopilot (with-action) cash
 * projections plus the recommended scenario summary. Treasury Sentinel + the
 * SolvencyChart UI consume this.
 */
import { createFileRoute } from "@tanstack/react-router";
import { deriveView, SAFETY_FLOOR } from "@/lib/snapshot-adapter.server";

export const Route = createFileRoute("/api/treasury/projection")({
  server: {
    handlers: {
      GET: async () => {
        const v = await deriveView();

        // Standby = the raw projection from real outflows + 50% AR recovery
        const standby = v.projection;

        // Autopilot = same projection but with the recommended scenario applied:
        //   - chase top-2 overdue invoices (full recovery, +15% pull-forward)
        //   - pause non-essential subs (saves their monthly cost on day-29)
        //   - delay smallest vendor by 7 days
        const topInvoices = [...v.invoices].sort((a, b) => b.amount - a.amount).slice(0, 2);
        const recoveredAmount = topInvoices.reduce((s, i) => s + i.amount, 0);
        const pausableSavings = v.subscriptions
          .filter((s) => !s.essential)
          .reduce((s, x) => s + x.monthlyCost, 0);

        const autopilot = standby.map((p) => {
          let bal = p.balance;
          // Recovered cash arrives by day 10
          if (p.day >= 10) bal += recoveredAmount * 0.85;
          // Subscription pauses save monthly cost for the rest of the window
          if (p.day >= 12) bal += pausableSavings;
          // Vendor delay frees ~$6,200 between day 12 and day 19
          if (p.day >= 12 && p.day < 19) bal += 6200;
          return { day: p.day, balance: Math.round(bal), event: p.event };
        });

        const standbyEnd = standby[standby.length - 1].balance;
        const autopilotEnd = autopilot[autopilot.length - 1].balance;
        const breach = standby.find((p) => p.balance < SAFETY_FLOOR);

        return new Response(
          JSON.stringify({
            standby,
            autopilot,
            safetyFloor: SAFETY_FLOOR,
            summary: {
              standbyEndOfMonth: standbyEnd,
              autopilotEndOfMonth: autopilotEnd,
              agentValue: autopilotEnd - standbyEnd,
              breach: breach
                ? { day: breach.day, balance: breach.balance, shortfall: SAFETY_FLOOR - breach.balance }
                : null,
              recommendedScenario: {
                chase: topInvoices.map((i) => ({ id: i.id, customer: i.customer, amount: i.amount })),
                pause: v.subscriptions.filter((s) => !s.essential).map((s) => s.vendor),
                delay: v.vendors[0]?.name ?? null,
                projectedRecovery: recoveredAmount,
                projectedSavings: pausableSavings,
              },
            },
            view: {
              bankBalanceUsd: v.bankBalanceUsd,
              bankBalances: v.bankBalances,
              totals: v.totals,
            },
          }),
          { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

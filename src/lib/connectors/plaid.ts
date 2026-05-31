/**
 * Plaid Sandbox connector — banking + cash positions.
 *
 * REAL PATH (recommended for the demo):
 *   When `PLAID_CLIENT_ID` and `PLAID_SECRET` are set, this hits Plaid's
 *   sandbox API to fetch real account balances. No OAuth flow required —
 *   the sandbox returns deterministic test accounts directly.
 *
 * DEMO PATH:
 *   When env is empty, returns deterministic fixtures for SVB (US) + HDFC (IN).
 *   Same shape as real Plaid `accounts/balance/get` response so the parsing
 *   logic stays identical.
 */
import type {
  Connector,
  CanonicalBankBalance,
  CanonicalInflow,
  CanonicalOutflow,
  CanonicalSubscription,
} from "./types";
import { toUsd } from "./types";

const PLAID_SANDBOX_URL = "https://sandbox.plaid.com";

export class PlaidConnector implements Connector {
  readonly id = "plaid" as const;
  readonly displayName = "Plaid";
  readonly category = "banking" as const;
  readonly icon = "🏦";
  readonly description = "Bank balances, transactions, account aggregation.";
  readonly regions = ["US", "Global"] as const;

  isReal(): boolean {
    return this.isConfigured();
  }

  isConfigured(): boolean {
    return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
  }

  async sync() {
    if (this.isConfigured()) {
      try {
        const real = await this.realSync();
        if (real) return real;
      } catch (e) {
        console.warn("[plaid] real sandbox sync failed, using fixtures:", (e as Error).message);
      }
    }
    return this.demoSync();
  }

  private async realSync() {
    // Step 1: create a sandbox public token
    const ptResp = await fetch(`${PLAID_SANDBOX_URL}/sandbox/public_token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_SECRET,
        institution_id: "ins_109508", // First Platypus Bank — Plaid's standard sandbox bank
        initial_products: ["transactions"],
      }),
    });
    if (!ptResp.ok) return null;
    const ptJson = (await ptResp.json()) as { public_token: string };

    // Step 2: exchange for access_token
    const exResp = await fetch(`${PLAID_SANDBOX_URL}/item/public_token/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_SECRET,
        public_token: ptJson.public_token,
      }),
    });
    if (!exResp.ok) return null;
    const exJson = (await exResp.json()) as { access_token: string };

    // Step 3: fetch balances
    const balResp = await fetch(`${PLAID_SANDBOX_URL}/accounts/balance/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_SECRET,
        access_token: exJson.access_token,
      }),
    });
    if (!balResp.ok) return null;
    const balJson = (await balResp.json()) as {
      accounts: Array<{
        name: string;
        balances: { available: number | null; current: number | null; iso_currency_code: string };
      }>;
    };

    const banks: CanonicalBankBalance[] = balJson.accounts
      .filter((a) => a.balances.available != null || a.balances.current != null)
      .map((a) => {
        const balance = a.balances.available ?? a.balances.current ?? 0;
        const currency = (a.balances.iso_currency_code === "INR" ? "INR" : "USD") as "USD" | "INR";
        return {
          source: "plaid" as const,
          account: a.name,
          balance,
          currency,
          balanceUsd: toUsd(balance, currency),
          asOf: new Date().toISOString(),
        };
      });

    return {
      inflows: [] as CanonicalInflow[],
      outflows: [] as CanonicalOutflow[],
      subscriptions: [] as CanonicalSubscription[],
      banks,
    };
  }

  private demoSync() {
    const banks: CanonicalBankBalance[] = [
      {
        source: "plaid",
        account: "Silicon Valley Bank · Operating",
        balance: 14_000,
        currency: "USD",
        balanceUsd: 14_000,
        asOf: new Date().toISOString(),
      },
      {
        source: "plaid",
        account: "HDFC Bank · INR Operations",
        balance: 18_75_000,
        currency: "INR",
        balanceUsd: toUsd(18_75_000, "INR"),
        asOf: new Date().toISOString(),
      },
    ];

    // A few outbound vendor bills surface from bank-level reconciliation.
    const outflows: CanonicalOutflow[] = [
      mkOutflow("plaid_bill_001", "Acme Cloud Hosting", 6200, "USD", 12, "vendor_bill", false),
      mkOutflow("plaid_bill_002", "Twilio Comms", 1800, "USD", 14, "vendor_bill", false),
      mkOutflow("plaid_bill_003", "AWS Reserved", 3170, "USD", 22, "vendor_bill", true),
      mkOutflow("plaid_payroll_001", "Payroll Run", 22_000, "USD", 15, "payroll", true),
      mkOutflow("plaid_bill_in_001", "Razorpay Fees", 47_000, "INR", 9, "fee", true),
    ];

    return {
      inflows: [] as CanonicalInflow[],
      outflows,
      subscriptions: [] as CanonicalSubscription[],
      banks,
    };
  }
}

function mkOutflow(
  id: string,
  vendor: string,
  amount: number,
  currency: "USD" | "INR",
  inDays: number,
  kind: CanonicalOutflow["kind"],
  recurring: boolean,
): CanonicalOutflow {
  const due = new Date(Date.now() + inDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    id,
    source: "plaid",
    kind,
    vendor,
    amount,
    currency,
    amountUsd: toUsd(amount, currency),
    dueAt: due,
    recurring,
  };
}

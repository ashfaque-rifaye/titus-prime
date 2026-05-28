/**
 * QuickBooks connector — accounting source-of-truth for AP / vendor bills.
 *
 * Surfaces vendor payables that aren't yet visible in the bank feed (booked
 * but not yet paid). Indian counterpart: Tally / Zoho Books.
 */
import type {
  Connector,
  CanonicalInflow,
  CanonicalOutflow,
  CanonicalSubscription,
  CanonicalBankBalance,
} from "./types";
import { toUsd } from "./types";

export class QuickBooksConnector implements Connector {
  readonly id = "quickbooks" as const;
  readonly displayName = "QuickBooks";
  readonly category = "accounting" as const;
  readonly icon = "📒";
  readonly description = "Booked AR/AP, journal entries, vendor terms.";
  readonly regions = ["US", "Global"] as const;

  isReal(): boolean {
    return false;
  }
  isConfigured(): boolean {
    return Boolean(process.env.QUICKBOOKS_TOKEN);
  }

  async sync() {
    const outflows: CanonicalOutflow[] = [
      {
        id: "qbo_bill_8841",
        source: "quickbooks",
        kind: "vendor_bill",
        vendor: "Cooley LLP (legal retainer)",
        amount: 4500,
        currency: "USD",
        amountUsd: 4500,
        dueAt: new Date(Date.now() + 9 * 86400_000).toISOString(),
        recurring: false,
      },
      {
        id: "qbo_bill_8852",
        source: "quickbooks",
        kind: "tax",
        vendor: "Texas Comptroller (Sales Tax Q4)",
        amount: 1420.5,
        currency: "USD",
        amountUsd: 1420.5,
        dueAt: new Date(Date.now() + 20 * 86400_000).toISOString(),
        recurring: false,
      },
    ];
    return {
      inflows: [] as CanonicalInflow[],
      outflows,
      subscriptions: [] as CanonicalSubscription[],
      banks: [] as CanonicalBankBalance[],
    };
  }
}

export class TallyConnector implements Connector {
  readonly id = "tally" as const;
  readonly displayName = "Tally";
  readonly category = "accounting" as const;
  readonly icon = "📔";
  readonly description = "Indian accounting ledger, GST registers, vendor masters.";
  readonly regions = ["IN"] as const;

  isReal(): boolean {
    return false;
  }
  isConfigured(): boolean {
    return Boolean(process.env.TALLY_TOKEN);
  }

  async sync() {
    const outflows: CanonicalOutflow[] = [
      {
        id: "tally_bill_001",
        source: "tally",
        kind: "vendor_bill",
        vendor: "AWS India (GST inv #IN-220034)",
        amount: 2_64_000,
        currency: "INR",
        amountUsd: toUsd(2_64_000, "INR"),
        dueAt: new Date(Date.now() + 11 * 86400_000).toISOString(),
        recurring: true,
      },
      {
        id: "tally_bill_002",
        source: "tally",
        kind: "tax",
        vendor: "GST Q3 Filing (CGST+SGST)",
        amount: 3_85_000,
        currency: "INR",
        amountUsd: toUsd(3_85_000, "INR"),
        dueAt: new Date(Date.now() + 18 * 86400_000).toISOString(),
        recurring: false,
      },
      {
        id: "tally_bill_003",
        source: "tally",
        kind: "payroll",
        vendor: "Indian Payroll Run (12 employees)",
        amount: 14_50_000,
        currency: "INR",
        amountUsd: toUsd(14_50_000, "INR"),
        dueAt: new Date(Date.now() + 15 * 86400_000).toISOString(),
        recurring: true,
      },
    ];
    return {
      inflows: [] as CanonicalInflow[],
      outflows,
      subscriptions: [] as CanonicalSubscription[],
      banks: [] as CanonicalBankBalance[],
    };
  }
}

export class ZohoBooksConnector implements Connector {
  readonly id = "zoho" as const;
  readonly displayName = "Zoho Books";
  readonly category = "accounting" as const;
  readonly icon = "📘";
  readonly description = "Indian SaaS accounting + invoicing.";
  readonly regions = ["IN"] as const;

  isReal(): boolean {
    return false;
  }
  isConfigured(): boolean {
    return Boolean(process.env.ZOHO_TOKEN);
  }

  async sync() {
    return {
      inflows: [] as CanonicalInflow[],
      outflows: [] as CanonicalOutflow[],
      subscriptions: [
        {
          id: "zoho_sub_001",
          source: "zoho" as const,
          vendor: "Zoho One (50 seats)",
          monthlyCost: 187_500,
          annualCost: 22_50_000,
          currency: "INR" as const,
          monthlyCostUsd: toUsd(187_500, "INR"),
          annualCostUsd: toUsd(22_50_000, "INR"),
          renewsIn: 28,
          cancelWindowClosesIn: 14,
          essential: true,
          notes: "Includes CRM, books, email — core stack",
        },
      ],
      banks: [] as CanonicalBankBalance[],
    };
  }
}

export class RazorpayConnector implements Connector {
  readonly id = "razorpay" as const;
  readonly displayName = "Razorpay";
  readonly category = "payments" as const;
  readonly icon = "💸";
  readonly description = "Indian payments — UPI, NetBanking, cards, payouts.";
  readonly regions = ["IN"] as const;

  isReal(): boolean {
    return false;
  }
  isConfigured(): boolean {
    return Boolean(process.env.RAZORPAY_KEY_ID);
  }

  async sync() {
    const inflows: CanonicalInflow[] = [
      {
        id: "rzp_inv_in_4401",
        source: "razorpay",
        kind: "invoice",
        customer: "Bharat Logistics Pvt Ltd",
        amount: 4_85_000,
        currency: "INR",
        amountUsd: toUsd(4_85_000, "INR"),
        issuedAt: new Date(Date.now() - 35 * 86400_000).toISOString(),
        dueAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
        daysLate: 5,
        status: "late",
      },
      {
        id: "rzp_inv_in_4412",
        source: "razorpay",
        kind: "invoice",
        customer: "Aarav SaaS Solutions",
        amount: 1_25_000,
        currency: "INR",
        amountUsd: toUsd(1_25_000, "INR"),
        issuedAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
        dueAt: new Date(Date.now() - 0 * 86400_000).toISOString(),
        daysLate: 0,
        status: "current",
      },
    ];
    return {
      inflows,
      outflows: [] as CanonicalOutflow[],
      subscriptions: [] as CanonicalSubscription[],
      banks: [] as CanonicalBankBalance[],
    };
  }
}

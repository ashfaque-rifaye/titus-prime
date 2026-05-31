// Mock CloudMetrics data for the demo. Tells a coherent crunch story.
export const COMPANY = {
  name: "CloudMetrics",
  founder: "Alex",
  mrr: 85_000,
  customers: 200,
  states: 15,
};

export const BANK_BALANCE = 32_400;
export const SAFETY_FLOOR = 5_000;

export type Invoice = {
  id: string;
  customer: string;
  amount: number;
  issued: string;
  due: string;
  daysLate: number;
  status: "current" | "late" | "very_late";
};

export const INVOICES: Invoice[] = [
  {
    id: "INV-1042",
    customer: "Acme Robotics",
    amount: 8200,
    issued: "2026-04-03",
    due: "2026-05-03",
    daysLate: 14,
    status: "late",
  },
  {
    id: "INV-1038",
    customer: "TechFlow Labs",
    amount: 3400,
    issued: "2026-04-01",
    due: "2026-05-01",
    daysLate: 16,
    status: "late",
  },
  {
    id: "INV-1029",
    customer: "Nimbus Health",
    amount: 1450,
    issued: "2026-03-20",
    due: "2026-04-19",
    daysLate: 28,
    status: "very_late",
  },
  {
    id: "INV-1025",
    customer: "Hexa Studios",
    amount: 920,
    issued: "2026-04-12",
    due: "2026-05-12",
    daysLate: 5,
    status: "late",
  },
  {
    id: "INV-1018",
    customer: "Loop Analytics",
    amount: 6400,
    issued: "2026-03-25",
    due: "2026-04-24",
    daysLate: 23,
    status: "very_late",
  },
  {
    id: "INV-1011",
    customer: "Mango Retail",
    amount: 2750,
    issued: "2026-04-15",
    due: "2026-05-15",
    daysLate: 2,
    status: "late",
  },
];

export type Subscription = {
  id: string;
  vendor: string;
  annualCost: number;
  monthlyCost: number;
  renewsIn: number; // days
  cancelWindowClosesIn: number; // days
  essential: boolean;
  notes?: string;
};

export const SUBSCRIPTIONS: Subscription[] = [
  {
    id: "sub-1",
    vendor: "Slack Enterprise",
    annualCost: 14400,
    monthlyCost: 1200,
    renewsIn: 8,
    cancelWindowClosesIn: 2,
    essential: false,
    notes: "Mostly duplicates Teams",
  },
  {
    id: "sub-2",
    vendor: "AWS Reserved",
    annualCost: 38000,
    monthlyCost: 3170,
    renewsIn: 42,
    cancelWindowClosesIn: 12,
    essential: true,
    notes: "+12% escalation July 1",
  },
  {
    id: "sub-3",
    vendor: "Notion Team",
    annualCost: 2880,
    monthlyCost: 240,
    renewsIn: 19,
    cancelWindowClosesIn: 5,
    essential: false,
  },
  {
    id: "sub-4",
    vendor: "Datadog",
    annualCost: 9600,
    monthlyCost: 800,
    renewsIn: 60,
    cancelWindowClosesIn: 30,
    essential: true,
  },
  {
    id: "sub-5",
    vendor: "Linear",
    annualCost: 1440,
    monthlyCost: 120,
    renewsIn: 90,
    cancelWindowClosesIn: 60,
    essential: true,
  },
];

export type Vendor = {
  id: string;
  name: string;
  amount: number;
  netDays: number;
  daysLeft: number;
  discountPct: number;
};
export const VENDORS: Vendor[] = [
  { id: "v1", name: "Acme Cloud Hosting", amount: 6200, netDays: 30, daysLeft: 6, discountPct: 2 },
  { id: "v2", name: "Twilio Comms", amount: 1800, netDays: 30, daysLeft: 14, discountPct: 0 },
];

export type StateRevenue = {
  state: string;
  revenueYTD: number;
  transactions: number;
  threshold: number;
  nexusCrossed: boolean;
  taxOwed: number;
};
export const STATE_REVENUE: StateRevenue[] = [
  {
    state: "CA",
    revenueYTD: 84_300,
    transactions: 142,
    threshold: 500_000,
    nexusCrossed: false,
    taxOwed: 0,
  },
  {
    state: "TX",
    revenueYTD: 100_200,
    transactions: 168,
    threshold: 100_000,
    nexusCrossed: true,
    taxOwed: 1420.5,
  },
  {
    state: "NY",
    revenueYTD: 62_800,
    transactions: 88,
    threshold: 500_000,
    nexusCrossed: false,
    taxOwed: 0,
  },
  {
    state: "FL",
    revenueYTD: 47_900,
    transactions: 71,
    threshold: 100_000,
    nexusCrossed: false,
    taxOwed: 0,
  },
];

export const PAYROLL = { amount: 22_000, day: 15 };

export const CASH_PROJECTION = (() => {
  // 30-day projection. The big payroll outflow on Day 15 plus a contractor
  // invoice on Day 11 drives the projected balance below the safety floor — the
  // crunch the rest of the demo coordinates around.
  let balance = BANK_BALANCE;
  const points: { day: number; balance: number; event?: string }[] = [];
  for (let d = 0; d <= 30; d++) {
    if (d === 5) balance += 4200; // Hexa pays
    if (d === 11) balance -= 11_000; // contractor invoice (W3)
    if (d === 12) balance -= 6200; // vendor v1
    if (d === 14) balance -= 1800; // vendor v2
    if (d === 15) balance -= PAYROLL.amount;
    if (d === 18) balance += 4400; // partial inflow
    if (d === 22) balance -= 3170; // aws
    if (d === 28) balance += 8600; // sub mrr
    let event: string | undefined;
    if (d === 11) event = "Contractor: W3 Studios";
    if (d === 12) event = "Vendor: Acme Cloud";
    if (d === 14) event = "Vendor: Twilio";
    if (d === 15) event = "Payroll";
    if (d === 22) event = "AWS";
    points.push({ day: d, balance: Math.round(balance), event });
  }
  return points;
})();

export const AGENTS = [
  {
    id: "treasury",
    name: "Treasury Sentinel",
    folder: "treasury",
    tone: "Watches your cash position 24/7.",
  },
  {
    id: "collection",
    name: "Collection & Receivables",
    folder: "collection",
    tone: "Drafts tone-aware reminders.",
  },
  {
    id: "subscription",
    name: "Subscription & Vendor Watchdog",
    folder: "subscription",
    tone: "Catches every renewal.",
  },
  { id: "tax", name: "Tax Compliance", folder: "tax", tone: "Multi-state SaaS nexus." },
  { id: "scenario", name: "Scenario Modeler", folder: "scenario", tone: "Ranks survival plans." },
  { id: "codex", name: "Codex Prime", folder: "codex", tone: "Writes the code, every time." },
] as const;
export type AgentId = (typeof AGENTS)[number]["id"];

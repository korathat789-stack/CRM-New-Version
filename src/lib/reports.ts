import { createClient } from "./supabase/server";
import { OPEN_STAGES, type StageCode } from "./stages";
import { marginPct } from "./margin";

// Assumptions for the P&L (configurable later via app_config).
const OPEX_RATE = 0.15; // operating expense as a share of revenue
const TAX_RATE = 0.2; // tax on operating profit

const OPEN_SET = new Set<StageCode>(OPEN_STAGES);

// --------------------------------------------------------------------------
// Sales Report
// --------------------------------------------------------------------------
export interface SalesReport {
  booked: number;
  target: number;
  attainment: number | null; // 0..1
  winRate: number | null; // 0..1
  pipeline: number;
  byStage: { stage: StageCode; value: number }[];
  byOwner: { name: string; won: number }[];
  estimate: { quotation: number; invoice: number; combined: number; openQuotes: number };
  closedWon: { title: string; customer: string | null; value: number; owner: string | null }[];
}

export async function getSalesReport(): Promise<SalesReport> {
  const supabase = await createClient();

  const { data: opps } = await supabase
    .from("opportunities")
    .select("title, stage, value, owner_id, customers(name), profiles!opportunities_owner_id_fkey(full_name)")
    .is("deleted_at", null);

  const rows = (opps ?? []) as unknown as {
    title: string;
    stage: StageCode;
    value: number;
    customers: { name: string } | null;
    profiles: { full_name: string | null } | null;
  }[];

  let booked = 0;
  let pipeline = 0;
  let won = 0;
  let lost = 0;
  const stageMap = new Map<StageCode, number>();
  const ownerMap = new Map<string, number>();
  const closedWon: SalesReport["closedWon"] = [];

  for (const o of rows) {
    if (OPEN_SET.has(o.stage)) {
      pipeline += o.value;
      stageMap.set(o.stage, (stageMap.get(o.stage) ?? 0) + o.value);
    } else if (o.stage === "won") {
      booked += o.value;
      won += 1;
      const owner = o.profiles?.full_name ?? "Unassigned";
      ownerMap.set(owner, (ownerMap.get(owner) ?? 0) + o.value);
      closedWon.push({
        title: o.title,
        customer: o.customers?.name ?? null,
        value: o.value,
        owner: o.profiles?.full_name ?? null,
      });
    } else if (o.stage === "lost") {
      lost += 1;
    }
  }

  const { data: config } = await supabase
    .from("app_config")
    .select("sales_target")
    .single();
  const target = config?.sales_target ?? 500000000;

  // Sales estimate: open quotations vs issued invoices.
  const { data: quotes } = await supabase
    .from("quotations")
    .select("total, status")
    .is("deleted_at", null);
  const openQuoteRows = (quotes ?? []).filter((q) =>
    ["draft", "sent", "partial"].includes(q.status as string)
  );
  const quotationEstimate = openQuoteRows.reduce(
    (s, q) => s + (q.total as number),
    0
  );

  const { data: invoices } = await supabase
    .from("invoices")
    .select("amount")
    .is("deleted_at", null);
  const invoiceActual = (invoices ?? []).reduce(
    (s, i) => s + (i.amount as number),
    0
  );

  const closedCount = won + lost;

  return {
    booked,
    target,
    attainment: target > 0 ? booked / target : null,
    winRate: closedCount > 0 ? won / closedCount : null,
    pipeline,
    byStage: OPEN_STAGES.map((stage) => ({
      stage,
      value: stageMap.get(stage) ?? 0,
    })),
    byOwner: [...ownerMap.entries()]
      .map(([name, won]) => ({ name, won }))
      .sort((a, b) => b.won - a.won),
    estimate: {
      quotation: quotationEstimate,
      invoice: invoiceActual,
      combined: quotationEstimate + invoiceActual,
      openQuotes: openQuoteRows.length,
    },
    closedWon,
  };
}

// --------------------------------------------------------------------------
// Cost Budgeting
// --------------------------------------------------------------------------
export interface CostReport {
  totalBudget: number;
  totalActual: number;
  variance: number;
  overCount: number;
  count: number;
  rows: {
    name: string;
    budget: number;
    actual: number;
    variance: number;
    usedPct: number;
    over: boolean;
  }[];
}

export async function getCostReport(): Promise<CostReport> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("name, budget, cost")
    .is("deleted_at", null)
    .order("budget", { ascending: false });

  const rows = (data ?? []).map((p) => {
    const budget = p.budget as number;
    const actual = p.cost as number;
    return {
      name: p.name as string,
      budget,
      actual,
      variance: budget - actual,
      usedPct: budget > 0 ? Math.min(100, (actual / budget) * 100) : 0,
      over: actual > budget,
    };
  });

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return {
    totalBudget,
    totalActual,
    variance: totalBudget - totalActual,
    overCount: rows.filter((r) => r.over).length,
    count: rows.length,
    rows,
  };
}

// --------------------------------------------------------------------------
// Accounting
// --------------------------------------------------------------------------
export interface AccountingReport {
  invoiced: number;
  received: number;
  outstanding: number;
  overdue: number;
  aging: { current: number; d1_30: number; d31_60: number; d60plus: number };
  rows: {
    number: string | null;
    customer: string | null;
    amount: number;
    due_date: string | null;
    status: string;
  }[];
}

export async function getAccountingReport(
  now: Date = new Date()
): Promise<AccountingReport> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("number, amount, received, due_date, status, customers(name)")
    .is("deleted_at", null)
    .order("issued_at", { ascending: false });

  const rows = (data ?? []) as unknown as {
    number: string | null;
    amount: number;
    received: number;
    due_date: string | null;
    status: string;
    customers: { name: string } | null;
  }[];

  let invoiced = 0;
  let received = 0;
  let overdue = 0;
  const aging = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };

  for (const inv of rows) {
    invoiced += inv.amount;
    received += inv.received;
    const out = inv.amount - inv.received;
    if (out <= 0 || inv.status === "paid") continue;
    if (!inv.due_date) {
      aging.current += out;
      continue;
    }
    const days = Math.floor(
      (now.getTime() - new Date(inv.due_date).getTime()) / 86400000
    );
    if (days <= 0) aging.current += out;
    else {
      overdue += out;
      if (days <= 30) aging.d1_30 += out;
      else if (days <= 60) aging.d31_60 += out;
      else aging.d60plus += out;
    }
  }

  return {
    invoiced,
    received,
    outstanding: invoiced - received,
    overdue,
    aging,
    rows: rows.map((r) => ({
      number: r.number,
      customer: r.customers?.name ?? null,
      amount: r.amount,
      due_date: r.due_date,
      status: r.status,
    })),
  };
}

// --------------------------------------------------------------------------
// Profit & Loss
// --------------------------------------------------------------------------
export interface PnlRow {
  label: string;
  revenue: number;
  cogs: number;
  gross: number;
  opex: number;
  ebit: number;
  tax: number;
  net: number;
  margin: number | null;
}

export interface PnlReport {
  months: PnlRow[];
  total: PnlRow;
}

function pnlFrom(label: string, revenue: number, cogs: number): PnlRow {
  const gross = revenue - cogs;
  const opex = Math.round(revenue * OPEX_RATE);
  const ebit = gross - opex;
  const tax = Math.round(Math.max(0, ebit) * TAX_RATE);
  const net = ebit - tax;
  return {
    label,
    revenue,
    cogs,
    gross,
    opex,
    ebit,
    tax,
    net,
    margin: revenue > 0 ? marginPct(revenue, revenue - net) : null,
  };
}

export async function getPnlReport(now: Date = new Date()): Promise<PnlReport> {
  const supabase = await createClient();
  // Won projects are the realized revenue source; bucket by due_date month
  // within the current quarter.
  const q = Math.floor(now.getUTCMonth() / 3);
  const months = [q * 3, q * 3 + 1, q * 3 + 2];
  const year = now.getUTCFullYear();

  const { data } = await supabase
    .from("projects")
    .select("value, cost, due_date, stage")
    .is("deleted_at", null)
    .eq("stage", "won");

  const byMonth = new Map<number, { revenue: number; cogs: number }>();
  for (const m of months) byMonth.set(m, { revenue: 0, cogs: 0 });

  for (const p of data ?? []) {
    if (!p.due_date) continue;
    const d = new Date(p.due_date as string);
    if (d.getUTCFullYear() !== year) continue;
    const m = d.getUTCMonth();
    const bucket = byMonth.get(m);
    if (bucket) {
      bucket.revenue += p.value as number;
      bucket.cogs += p.cost as number;
    }
  }

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const rows = months.map((m) =>
    pnlFrom(monthLabels[m], byMonth.get(m)!.revenue, byMonth.get(m)!.cogs)
  );
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0);

  return {
    months: rows,
    total: pnlFrom(`Q${q + 1}`, totalRevenue, totalCogs),
  };
}

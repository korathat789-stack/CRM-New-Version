import { createClient } from "./supabase/server";
import { type StageCode } from "./stages";
import { marginPct, marginAmount } from "./margin";

export interface ProjectRow {
  id: string;
  code: string | null;
  name: string;
  stage: StageCode;
  value: number; // satang
  cost: number; // satang
  budget: number; // satang
  due_date: string | null;
  est_date: string | null;
  progress: number;
  customer_id: string;
  customer_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  margin_pct: number | null;
  margin_amount: number;
}

export interface ProjectTotals {
  count: number;
  value: number;
  cost: number;
  margin_pct: number | null;
}

export type DueFilter = "all" | "overdue" | "quarter";
export type ProjectSort = "value" | "margin" | "due";

export interface ListProjectsParams {
  q?: string;
  stage?: StageCode;
  ownerId?: string;
  valueMin?: number; // satang
  due?: DueFilter;
  sort?: ProjectSort;
}

function quarterBounds(now: Date): { start: string; end: string } {
  const q = Math.floor(now.getUTCMonth() / 3);
  const start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), q * 3 + 3, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function listProjects(
  params: ListProjectsParams,
  now: Date = new Date()
): Promise<{ rows: ProjectRow[]; totals: ProjectTotals }> {
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select(
      "id, code, name, stage, value, cost, budget, due_date, est_date, progress, customer_id, owner_id, customers(name), profiles!projects_owner_id_fkey(full_name)"
    )
    .is("deleted_at", null);

  if (params.stage) query = query.eq("stage", params.stage);
  if (params.ownerId) query = query.eq("owner_id", params.ownerId);
  if (params.valueMin && params.valueMin > 0) {
    query = query.gte("value", params.valueMin);
  }
  if (params.due === "overdue") {
    query = query.lt("due_date", now.toISOString().slice(0, 10));
  } else if (params.due === "quarter") {
    const { start, end } = quarterBounds(now);
    query = query.gte("due_date", start).lte("due_date", end);
  }
  if (params.q && params.q.trim()) {
    query = query.ilike("name", `%${params.q.trim()}%`);
  }

  const sortCol =
    params.sort === "due" ? "due_date" : params.sort === "margin" ? "value" : "value";
  query = query.order(sortCol, {
    ascending: params.sort === "due",
    nullsFirst: false,
  });

  const { data, error } = await query;
  if (error) throw error;

  let rows: ProjectRow[] = (data ?? []).map((r) => {
    const row = r as unknown as Record<string, unknown> & {
      customers: { name: string } | null;
      profiles: { full_name: string | null } | null;
    };
    const value = row.value as number;
    const cost = row.cost as number;
    return {
      id: row.id as string,
      code: (row.code as string) ?? null,
      name: row.name as string,
      stage: row.stage as StageCode,
      value,
      cost,
      budget: row.budget as number,
      due_date: (row.due_date as string) ?? null,
      est_date: (row.est_date as string) ?? null,
      progress: row.progress as number,
      customer_id: row.customer_id as string,
      customer_name: row.customers?.name ?? null,
      owner_id: (row.owner_id as string) ?? null,
      owner_name: row.profiles?.full_name ?? null,
      margin_pct: marginPct(value, cost),
      margin_amount: marginAmount(value, cost),
    };
  });

  // Margin sort can't be done in SQL (computed) — sort in JS when requested.
  if (params.sort === "margin") {
    rows = rows.sort((a, b) => (b.margin_pct ?? -1) - (a.margin_pct ?? -1));
  }

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);

  return {
    rows,
    totals: {
      count: rows.length,
      value: totalValue,
      cost: totalCost,
      margin_pct: marginPct(totalValue, totalCost),
    },
  };
}

export interface ProjectDetail extends ProjectRow {
  opportunity_id: string | null;
  opportunity_code: string | null;
  customer_code: string | null;
  quotation_number: string | null;
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, code, name, stage, value, cost, budget, due_date, est_date, progress, customer_id, owner_id, opportunity_id, customers(name, code), profiles!projects_owner_id_fkey(full_name), opportunities(code)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as Record<string, unknown> & {
    customers: { name: string; code: string | null } | null;
    profiles: { full_name: string | null } | null;
    opportunities: { code: string | null } | null;
  };
  const value = row.value as number;
  const cost = row.cost as number;

  // Best-effort linked quotation (same opportunity), if any.
  let quotationNumber: string | null = null;
  if (row.opportunity_id) {
    const { data: q } = await supabase
      .from("quotations")
      .select("number")
      .eq("opportunity_id", row.opportunity_id as string)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    quotationNumber = q?.number ?? null;
  }

  return {
    id: row.id as string,
    code: (row.code as string) ?? null,
    name: row.name as string,
    stage: row.stage as StageCode,
    value,
    cost,
    budget: row.budget as number,
    due_date: (row.due_date as string) ?? null,
    est_date: (row.est_date as string) ?? null,
    progress: row.progress as number,
    customer_id: row.customer_id as string,
    customer_name: row.customers?.name ?? null,
    customer_code: row.customers?.code ?? null,
    owner_id: (row.owner_id as string) ?? null,
    owner_name: row.profiles?.full_name ?? null,
    opportunity_id: (row.opportunity_id as string) ?? null,
    opportunity_code: row.opportunities?.code ?? null,
    quotation_number: quotationNumber,
    margin_pct: marginPct(value, cost),
    margin_amount: marginAmount(value, cost),
  };
}

/** Distinct project owners for the owner filter. */
export async function listProjectOwners(): Promise<
  { id: string; name: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string) ?? "—",
  }));
}


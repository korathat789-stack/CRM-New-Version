import { createClient } from "./supabase/server";
import { getGradeBands } from "./config";
import { computeGrade } from "./grade";
import { OPEN_STAGES, type StageCode } from "./stages";
import type {
  Customer,
  CustomerWithStats,
  Contact,
  CustomerType,
  CustomerLinkedProject,
  CustomerActivity,
} from "./types";
import type { Grade, GradeBasis } from "./grade";

export interface CustomerListItem extends Customer {
  type_label_en: string | null;
  type_label_th: string | null;
  owner_name: string | null;
  open_pipeline: number; // satang
  grade: Grade;
}

export interface ListCustomersParams {
  q?: string;
  grade?: Grade;
  basis: GradeBasis;
}

const OPEN_SET = new Set<StageCode>(OPEN_STAGES);

/** Search + filter the (non-deleted) customers, with open-pipeline rollup. */
export async function listCustomers(
  params: ListCustomersParams
): Promise<CustomerListItem[]> {
  const supabase = await createClient();
  // Grade is computed from the (user-editable) config bands so changes take
  // effect immediately — not from the fixed generated columns.
  const bands = await getGradeBands(params.basis);

  // Select only the columns the list/preview render (skips notes/address text
  // and timestamps) to keep the payload small.
  let query = supabase
    .from("customers")
    .select(
      "id, code, name, tax_id, type_id, province, owner_id, annual_revenue, lifetime_revenue, source, industry, customer_types(label_en, label_th), profiles!customers_owner_id_fkey(full_name)"
    )
    .is("deleted_at", null)
    .order("name");

  if (params.q && params.q.trim()) {
    const term = `%${params.q.trim()}%`;
    query = query.or(`name.ilike.${term},code.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];

  // Roll up open pipeline per customer in one query.
  const ids = rows.map((r) => r.id);
  const pipeline = await openPipelineByCustomer(ids);

  const items = rows.map((row) => {
    const { customer_types, profiles, ...customer } = row as unknown as Record<
      string,
      unknown
    > & {
      customer_types: { label_en: string; label_th: string } | null;
      profiles: { full_name: string | null } | null;
    };
    const c = customer as unknown as Customer;
    const amount =
      params.basis === "annual" ? c.annual_revenue : c.lifetime_revenue;
    return {
      ...c,
      type_label_en: customer_types?.label_en ?? null,
      type_label_th: customer_types?.label_th ?? null,
      owner_name: profiles?.full_name ?? null,
      open_pipeline: pipeline.get(c.id) ?? 0,
      grade: computeGrade(amount, bands),
    };
  });

  return params.grade ? items.filter((i) => i.grade === params.grade) : items;
}

async function openPipelineByCustomer(
  customerIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (customerIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("customer_id, value, stage")
    .in("customer_id", customerIds)
    .is("deleted_at", null);
  for (const row of data ?? []) {
    if (OPEN_SET.has(row.stage as StageCode)) {
      map.set(
        row.customer_id as string,
        (map.get(row.customer_id as string) ?? 0) + (row.value as number)
      );
    }
  }
  return map;
}

/** Full Customer 360 record: profile, contacts, linked projects, KPIs. */
export async function getCustomer(
  id: string
): Promise<CustomerWithStats | null> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("customers")
    .select(
      "*, customer_types(*), profiles!customers_owner_id_fkey(full_name)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { customer_types, profiles, ...rest } = row as Record<string, unknown> & {
    customer_types: CustomerType | null;
    profiles: { full_name: string | null } | null;
  };
  const customer = rest as unknown as Customer;

  const [contactsRes, projectsRes, oppsRes, activitiesRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false }),
    supabase
      .from("projects")
      .select("id, code, name, stage, value")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("value", { ascending: false }),
    supabase
      .from("opportunities")
      .select("value, stage")
      .eq("customer_id", id)
      .is("deleted_at", null),
    supabase
      .from("activities")
      .select("id, type, summary, occurred_at")
      .eq("customer_id", id)
      .order("occurred_at", { ascending: false })
      .limit(5),
  ]);

  const contacts = (contactsRes.data ?? []) as Contact[];
  const opps = (oppsRes.data ?? []) as { value: number; stage: StageCode }[];

  let openPipeline = 0;
  let openCount = 0;
  let won = 0;
  let lost = 0;
  for (const o of opps) {
    if (OPEN_SET.has(o.stage)) {
      openPipeline += o.value;
      openCount += 1;
    } else if (o.stage === "won") won += 1;
    else if (o.stage === "lost") lost += 1;
  }
  const closed = won + lost;

  const activities = (activitiesRes.data ?? []) as CustomerActivity[];

  return {
    ...customer,
    type: customer_types ?? null,
    owner_name: profiles?.full_name ?? null,
    primary_contact: contacts.find((c) => c.is_primary) ?? contacts[0] ?? null,
    contacts,
    projects: (projectsRes.data ?? []) as CustomerLinkedProject[],
    activities,
    open_pipeline: openPipeline,
    win_rate: closed > 0 ? won / closed : null,
    open_opportunities: openCount,
    last_activity_at: activities[0]?.occurred_at ?? null,
  };
}

/** Find a non-deleted customer with the same Tax ID (duplicate check). */
export async function findCustomerByTaxId(
  taxId: string,
  excludeId?: string
): Promise<{ id: string; code: string | null; name: string } | null> {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, code, name")
    .eq("tax_id", taxId)
    .is("deleted_at", null);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.limit(1);
  return data?.[0] ?? null;
}

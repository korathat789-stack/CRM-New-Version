import { createClient } from "./supabase/server";
import type { StageCode } from "./stages";
import {
  type GateContext,
  completeness,
  nextStage,
  evaluateGate,
} from "./gates";

export interface OpportunityListItem {
  id: string;
  code: string | null;
  title: string;
  stage: StageCode;
  value: number;
  next_step: string | null;
  customer_id: string;
  customer_name: string | null;
}

export async function listOpportunities(): Promise<OpportunityListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select("id, code, title, stage, value, next_step, customer_id, customers(name)")
    .is("deleted_at", null)
    .order("value", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as unknown as OpportunityListItem & {
      customers: { name: string } | null;
    };
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      stage: row.stage,
      value: row.value,
      next_step: row.next_step,
      customer_id: row.customer_id,
      customer_name: row.customers?.name ?? null,
    };
  });
}

export interface OpportunityDetail {
  id: string;
  code: string | null;
  title: string;
  stage: StageCode;
  value: number;
  next_step: string | null;
  customer_id: string;
  customer_name: string | null;
  poc_scheduled_at: string | null;
  poc_result: string | null;
  signed_quote_url: string | null;
  authorized_by: string | null;
  ctx: GateContext;
  completeness: ReturnType<typeof completeness>;
  next: StageCode | null;
  nextGate: ReturnType<typeof evaluateGate> | null;
}

export async function getOpportunity(
  id: string
): Promise<OpportunityDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id, code, title, stage, value, next_step, customer_id, poc_scheduled_at, poc_result, signed_quote_url, authorized_by, customers(name, type_id, owner_id)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    code: string | null;
    title: string;
    stage: StageCode;
    value: number;
    next_step: string | null;
    customer_id: string;
    poc_scheduled_at: string | null;
    poc_result: string | null;
    signed_quote_url: string | null;
    authorized_by: string | null;
    customers: { name: string; type_id: string | null; owner_id: string | null } | null;
  };

  const [{ count: presentationCount }, quote] = await Promise.all([
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", id)
      .ilike("type", "presentation"),
    supabase
      .from("quotations")
      .select("number, total, sent_at")
      .eq("opportunity_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data as { number: string | null; total: number; sent_at: string | null } | null),
  ]);

  const ctx: GateContext = {
    customerName: Boolean(row.customers?.name),
    customerType: Boolean(row.customers?.type_id),
    customerOwner: Boolean(row.customers?.owner_id),
    oppValue: row.value > 0,
    presentationLogged: (presentationCount ?? 0) > 0,
    quoteNumber: Boolean(quote?.number),
    quoteAmount: (quote?.total ?? 0) > 0,
    quoteSent: Boolean(quote?.sent_at),
    pocScheduled: Boolean(row.poc_scheduled_at),
    pocResult: Boolean(row.poc_result && row.poc_result.trim()),
    signedQuote: Boolean(row.signed_quote_url),
    authorized: Boolean(row.authorized_by),
  };

  const next = nextStage(row.stage);

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    stage: row.stage,
    value: row.value,
    next_step: row.next_step,
    customer_id: row.customer_id,
    customer_name: row.customers?.name ?? null,
    poc_scheduled_at: row.poc_scheduled_at,
    poc_result: row.poc_result,
    signed_quote_url: row.signed_quote_url,
    authorized_by: row.authorized_by,
    ctx,
    completeness: completeness(ctx),
    next,
    nextGate: next ? evaluateGate(next, ctx) : null,
  };
}

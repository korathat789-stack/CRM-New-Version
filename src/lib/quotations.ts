import { createClient } from "./supabase/server";

export interface QuotationListItem {
  id: string;
  number: string | null;
  customer_name: string | null;
  total: number; // satang
  status: string;
  quotation_date: string;
}

export async function listQuotations(): Promise<QuotationListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, number, total, status, quotation_date, customers(name)")
    .is("deleted_at", null)
    .order("quotation_date", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      number: string | null;
      total: number;
      status: string;
      quotation_date: string;
      customers: { name: string } | null;
    };
    return {
      id: row.id,
      number: row.number,
      customer_name: row.customers?.name ?? null,
      total: row.total,
      status: row.status,
      quotation_date: row.quotation_date,
    };
  });
}

export interface QuotationItem {
  line_no: number;
  description: string;
  unit_price: number;
  qty: number;
  discount_pct: number;
  amount: number;
}

export interface QuotationDetail {
  id: string;
  number: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_code: string | null;
  quotation_date: string;
  expiring_date: string | null;
  credit_term: number | null;
  vat_mode: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  remark: string | null;
  terms: string | null;
  status: string;
  items: QuotationItem[];
}

export async function getQuotation(id: string): Promise<QuotationDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, number, customer_id, quotation_date, expiring_date, credit_term, vat_mode, subtotal, vat_amount, total, remark, terms, status, customers(name, code)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as Record<string, unknown> & {
    customers: { name: string; code: string | null } | null;
  };

  const { data: items } = await supabase
    .from("quotation_items")
    .select("line_no, description, unit_price, qty, discount_pct, amount")
    .eq("quotation_id", id)
    .order("line_no");

  return {
    id: row.id as string,
    number: (row.number as string) ?? null,
    customer_id: row.customer_id as string,
    customer_name: row.customers?.name ?? null,
    customer_code: row.customers?.code ?? null,
    quotation_date: row.quotation_date as string,
    expiring_date: (row.expiring_date as string) ?? null,
    credit_term: (row.credit_term as number) ?? null,
    vat_mode: row.vat_mode as string,
    subtotal: row.subtotal as number,
    vat_amount: row.vat_amount as number,
    total: row.total as number,
    remark: (row.remark as string) ?? null,
    terms: (row.terms as string) ?? null,
    status: row.status as string,
    items: (items ?? []) as QuotationItem[],
  };
}

export const QUOTATION_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#f1f5f9", fg: "#475569" },
  sent: { bg: "#e0f2fe", fg: "#0369a1" },
  partial: { bg: "#fef9c3", fg: "#a16207" },
  paid: { bg: "#dcfce7", fg: "#15803d" },
  overdue: { bg: "#fee2e2", fg: "#b91c1c" },
  cancelled: { bg: "#f1f5f9", fg: "#94a3b8" },
};

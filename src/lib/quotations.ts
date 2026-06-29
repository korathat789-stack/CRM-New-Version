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

export const QUOTATION_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#f1f5f9", fg: "#475569" },
  sent: { bg: "#e0f2fe", fg: "#0369a1" },
  partial: { bg: "#fef9c3", fg: "#a16207" },
  paid: { bg: "#dcfce7", fg: "#15803d" },
  overdue: { bg: "#fee2e2", fg: "#b91c1c" },
  cancelled: { bg: "#f1f5f9", fg: "#94a3b8" },
};

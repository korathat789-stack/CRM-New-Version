"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getVatRatePct } from "@/lib/config";
import { parseBahtToSatang } from "@/lib/money";
import {
  computeTotals,
  lineAmount,
  type VatMode,
  type QuotationLineInput,
} from "@/lib/quotation";

export interface QuotationFormState {
  ok: boolean;
  error?: string;
}

export interface PickerCustomer {
  id: string;
  code: string | null;
  name: string;
  tax_id: string | null;
  province: string | null;
  grade: string;
}

/** Search the SAME customers table used by the Customers page (for the picker). */
export async function searchCustomersForPicker(
  q: string
): Promise<PickerCustomer[]> {
  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, code, name, tax_id, province, grade_annual")
    .is("deleted_at", null)
    .order("name")
    .limit(8);
  if (q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`name.ilike.${term},code.ilike.${term}`);
  }
  const { data } = await query;
  return (data ?? []).map((c) => ({
    id: c.id as string,
    code: (c.code as string) ?? null,
    name: c.name as string,
    tax_id: (c.tax_id as string) ?? null,
    province: (c.province as string) ?? null,
    grade: (c.grade_annual as string) ?? "F",
  }));
}

interface RawLine {
  description: string;
  model?: string;
  uom?: string;
  category?: string;
  unit_price: string; // baht string
  qty: string;
  discount_pct: string;
}

interface RawPaymentTerm {
  percent: string;
  condition: string;
}

/** Parse the serialized payment-term rows: keep only rows with a condition,
 *  coerce percent to a number. Returns [] when unparseable/empty. */
function parsePaymentTerms(raw: string): { percent: number; condition: string }[] {
  try {
    const rows = JSON.parse(raw || "[]") as RawPaymentTerm[];
    return rows
      .filter((p) => p.condition?.trim())
      .map((p) => ({ percent: Number(p.percent) || 0, condition: p.condition.trim() }));
  } catch {
    return [];
  }
}

export async function createQuotation(
  _prev: QuotationFormState,
  formData: FormData
): Promise<QuotationFormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) return { ok: false, error: "customerRequired" };

  const vatMode = (String(formData.get("vat_mode") ?? "excluded") === "included"
    ? "included"
    : "excluded") as VatMode;
  const intent = String(formData.get("intent") ?? "issue");
  const creditTerm = Number(formData.get("credit_term") ?? 30) || 30;

  let raw: RawLine[] = [];
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    raw = [];
  }
  const lines: QuotationLineInput[] = raw
    .filter((l) => l.description?.trim())
    .map((l) => ({
      description: l.description.trim(),
      model: l.model?.trim() || null,
      uom: l.uom?.trim() || null,
      category: l.category?.trim() || null,
      unit_price: parseBahtToSatang(l.unit_price) ?? 0,
      qty: Number(l.qty) || 0,
      discount_pct: Number(l.discount_pct) || 0,
    }));

  if (lines.length === 0) return { ok: false, error: "noLines" };

  const vatRate = await getVatRatePct();
  const totals = computeTotals(lines, vatRate, vatMode);

  const supabase = await createClient();
  const { data: quote, error } = await supabase
    .from("quotations")
    .insert({
      customer_id: customerId,
      opportunity_id: String(formData.get("opportunity_id") ?? "") || null,
      quotation_date:
        String(formData.get("quotation_date") ?? "") ||
        new Date().toISOString().slice(0, 10),
      expiring_date: String(formData.get("expiring_date") ?? "") || null,
      credit_term: creditTerm,
      vat_mode: vatMode,
      subtotal: totals.subtotal,
      vat_amount: totals.vat,
      total: totals.total,
      remark: String(formData.get("remark") ?? "") || null,
      terms: String(formData.get("terms") ?? "") || null,
      validity_days: Number(formData.get("validity_days") ?? 30) || 30,
      payment_terms: parsePaymentTerms(String(formData.get("payment_terms") ?? "[]")),
      status: intent === "draft" ? "draft" : "sent",
      sent_at: intent === "draft" ? null : new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !quote) return { ok: false, error: error?.message ?? "saveFailed" };

  const items = lines.map((l, i) => ({
    quotation_id: quote.id,
    line_no: i + 1,
    description: l.description,
    model: l.model ?? null,
    uom: l.uom ?? null,
    category: l.category ?? null,
    unit_price: l.unit_price,
    qty: l.qty,
    discount_pct: l.discount_pct,
    amount: lineAmount(l),
  }));
  const { error: itemsError } = await supabase
    .from("quotation_items")
    .insert(items);
  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/quotations");
  redirect("/quotations");
}

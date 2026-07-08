import { createClient } from "./supabase/server";
import { getVatRatePct } from "./config";
import type { PdfItemInput, QuotationPaymentTerm } from "./quotationPdfModel";
import { COMPANY } from "./company";

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

export interface QuotationPdfData {
  number: string | null;
  quotationDate: string;
  validityDays: number;
  vatRatePct: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  remark: string | null;
  paymentTerms: QuotationPaymentTerm[];
  salesPerson: string | null;
  items: PdfItemInput[];
  customer: {
    name: string;
    address: string | null;
    province: string | null;
    taxId: string | null;
    contactName: string | null;
    contactTitle: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  };
}

export async function getQuotationForPdf(
  id: string
): Promise<QuotationPdfData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      `number, quotation_date, validity_days, vat_amount, subtotal, total, remark, payment_terms,
       created_by,
       creator:profiles!quotations_created_by_fkey(full_name),
       customers(name, address, province, tax_id,
         contacts(name, title, phone, email, is_primary)),
       quotation_items(line_no, model, description, category, qty, uom, unit_price, amount)`
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as {
    number: string | null;
    quotation_date: string;
    validity_days: number | null;
    vat_amount: number;
    subtotal: number;
    total: number;
    remark: string | null;
    payment_terms: QuotationPaymentTerm[] | null;
    creator: { full_name: string | null } | null;
    customers: {
      name: string;
      address: string | null;
      province: string | null;
      tax_id: string | null;
      contacts: {
        name: string;
        title: string | null;
        phone: string | null;
        email: string | null;
        is_primary: boolean;
      }[];
    } | null;
    quotation_items: PdfItemInput[];
  };

  const contact =
    row.customers?.contacts?.find((c) => c.is_primary) ??
    row.customers?.contacts?.[0] ??
    null;

  const paymentTerms =
    Array.isArray(row.payment_terms) && row.payment_terms.length > 0
      ? row.payment_terms
      : [COMPANY.defaultPaymentTerm];

  return {
    number: row.number,
    quotationDate: row.quotation_date,
    validityDays: row.validity_days ?? 30,
    vatRatePct: await getVatRatePct(),
    subtotal: row.subtotal,
    vatAmount: row.vat_amount,
    total: row.total,
    remark: row.remark,
    paymentTerms,
    salesPerson: row.creator?.full_name ?? null,
    items: [...(row.quotation_items ?? [])].sort((a, b) => a.line_no - b.line_no),
    customer: {
      name: row.customers?.name ?? "",
      address: row.customers?.address ?? null,
      province: row.customers?.province ?? null,
      taxId: row.customers?.tax_id ?? null,
      contactName: contact?.name ?? null,
      contactTitle: contact?.title ?? null,
      contactPhone: contact?.phone ?? null,
      contactEmail: contact?.email ?? null,
    },
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

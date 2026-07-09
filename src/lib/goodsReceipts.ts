import { createClient } from "./supabase/server";
import {
  isGoodsReceiptStatus,
  receiptTotalQty,
  type GoodsReceiptStatus,
} from "./goodsReceipts-shared";

export {
  receiptTotalQty,
  canEditReceipt,
  canApproveReceipt,
  isGoodsReceiptStatus,
  GR_STATUS_COLORS,
  GR_STATUS_LABEL_KEYS,
  type GoodsReceiptStatus,
} from "./goodsReceipts-shared";

export interface GoodsReceiptRow {
  id: string;
  code: string | null;
  supplier: string;
  receipt_date: string;
  status: GoodsReceiptStatus;
  line_count: number;
  total_qty: number;
  received_by_name: string | null;
}

export interface GoodsReceiptItemDetail {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  qty: number;
  unit: string;
}

export interface GoodsReceiptDetail {
  id: string;
  code: string | null;
  supplier: string;
  po_ref: string | null;
  receipt_date: string;
  status: GoodsReceiptStatus;
  note: string | null;
  received_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  items: GoodsReceiptItemDetail[];
}

export interface ProductOption {
  id: string;
  code: string;
  name: string;
  unit: string;
}

export async function listGoodsReceipts(filters: {
  status?: string;
}): Promise<GoodsReceiptRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("goods_receipts")
    .select(
      `id, code, supplier, receipt_date, status,
       receiver:profiles!goods_receipts_received_by_fkey(full_name),
       goods_receipt_items(qty)`
    )
    .is("deleted_at", null)
    .order("receipt_date", { ascending: false });

  if (filters.status && isGoodsReceiptStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      code: string | null;
      supplier: string;
      receipt_date: string;
      status: GoodsReceiptStatus;
      receiver: { full_name: string | null } | null;
      goods_receipt_items: { qty: number }[];
    };
    const items = row.goods_receipt_items ?? [];
    return {
      id: row.id,
      code: row.code,
      supplier: row.supplier,
      receipt_date: row.receipt_date,
      status: row.status,
      line_count: items.length,
      total_qty: receiptTotalQty(items),
      received_by_name: row.receiver?.full_name ?? null,
    };
  });
}

const RECEIPT_DETAIL_SELECT = `
  id, code, supplier, po_ref, receipt_date, status, note, approved_at,
  receiver:profiles!goods_receipts_received_by_fkey(full_name),
  approver:profiles!goods_receipts_approved_by_fkey(full_name),
  goods_receipt_items(id, qty, unit, products(id, code, name))`;

function mapReceiptDetail(r: unknown): GoodsReceiptDetail {
  const row = r as {
    id: string;
    code: string | null;
    supplier: string;
    po_ref: string | null;
    receipt_date: string;
    status: GoodsReceiptStatus;
    note: string | null;
    approved_at: string | null;
    receiver: { full_name: string | null } | null;
    approver: { full_name: string | null } | null;
    goods_receipt_items: {
      id: string;
      qty: number;
      unit: string;
      products: { id: string; code: string; name: string } | null;
    }[];
  };
  return {
    id: row.id,
    code: row.code,
    supplier: row.supplier,
    po_ref: row.po_ref,
    receipt_date: row.receipt_date,
    status: row.status,
    note: row.note,
    received_by_name: row.receiver?.full_name ?? null,
    approved_by_name: row.approver?.full_name ?? null,
    approved_at: row.approved_at,
    items: (row.goods_receipt_items ?? []).map((i) => ({
      id: i.id,
      product_id: i.products?.id ?? "",
      product_code: i.products?.code ?? "",
      product_name: i.products?.name ?? "",
      qty: i.qty,
      unit: i.unit,
    })),
  };
}

export async function getGoodsReceipt(
  id: string
): Promise<GoodsReceiptDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(RECEIPT_DETAIL_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapReceiptDetail(data);
}

export async function listPendingReceipts(): Promise<GoodsReceiptDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(RECEIPT_DETAIL_SELECT)
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("receipt_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapReceiptDetail);
}

export async function listProductOptions(): Promise<ProductOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, code, name, unit")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductOption[];
}

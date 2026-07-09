"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export interface ReceiptFormState {
  ok: boolean;
  error?: string;
}

interface RawLine {
  product_id: string;
  qty: number;
  unit: string;
}

async function requireManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "manager") return null;
  return user;
}

function readHeader(formData: FormData) {
  return {
    supplier: String(formData.get("supplier") ?? "").trim(),
    po_ref: String(formData.get("po_ref") ?? "").trim() || null,
    receipt_date: String(formData.get("receipt_date") ?? "") || null,
    note: String(formData.get("note") ?? "").trim() || null,
  };
}

function readLines(formData: FormData): RawLine[] {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => {
      const o = l as { product_id?: unknown; qty?: unknown; unit?: unknown };
      return {
        product_id: String(o.product_id ?? ""),
        qty: Math.trunc(Number(o.qty) || 0),
        unit: String(o.unit ?? "unit") || "unit",
      };
    })
    .filter((l) => l.product_id && l.qty > 0);
}

export async function createGoodsReceipt(
  _prev: ReceiptFormState,
  formData: FormData
): Promise<ReceiptFormState> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };

  const header = readHeader(formData);
  const lines = readLines(formData);
  if (!header.supplier || lines.length === 0) {
    return { ok: false, error: "required" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .insert({
      supplier: header.supplier,
      po_ref: header.po_ref,
      receipt_date: header.receipt_date ?? undefined,
      note: header.note,
      received_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "saveFailed" };

  const { error: itemsError } = await supabase.from("goods_receipt_items").insert(
    lines.map((l) => ({
      receipt_id: data.id,
      product_id: l.product_id,
      qty: l.qty,
      unit: l.unit,
    }))
  );
  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/goods-receipts");
  redirect(`/goods-receipts/${data.id}`);
}

export async function updateGoodsReceipt(
  _prev: ReceiptFormState,
  formData: FormData
): Promise<ReceiptFormState> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };

  const id = String(formData.get("id") ?? "");
  const header = readHeader(formData);
  const lines = readLines(formData);
  if (!id || !header.supplier || lines.length === 0) {
    return { ok: false, error: "required" };
  }

  const supabase = await createClient();

  // Guard: only a pending receipt may be edited.
  const { data: current } = await supabase
    .from("goods_receipts")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "notFound" };
  if (current.status !== "pending") return { ok: false, error: "notPending" };

  const { error: headErr } = await supabase
    .from("goods_receipts")
    .update({
      supplier: header.supplier,
      po_ref: header.po_ref,
      receipt_date: header.receipt_date ?? undefined,
      note: header.note,
    })
    .eq("id", id);
  if (headErr) return { ok: false, error: headErr.message };

  // Replace items.
  const { error: delErr } = await supabase
    .from("goods_receipt_items")
    .delete()
    .eq("receipt_id", id);
  if (delErr) return { ok: false, error: delErr.message };
  const { error: insErr } = await supabase.from("goods_receipt_items").insert(
    lines.map((l) => ({
      receipt_id: id,
      product_id: l.product_id,
      qty: l.qty,
      unit: l.unit,
    }))
  );
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/goods-receipts");
  revalidatePath(`/goods-receipts/${id}`);
  redirect(`/goods-receipts/${id}`);
}

export async function deleteGoodsReceipt(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("goods_receipts")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "notFound" };
  if (current.status !== "pending") return { ok: false, error: "notPending" };

  const { error } = await supabase
    .from("goods_receipts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/goods-receipts");
  return { ok: true };
}

export async function approveGoodsReceipt(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_goods_receipt", {
    p_receipt_id: id,
  });
  if (error) {
    if (error.message.includes("not_pending"))
      return { ok: false, error: "notPending" };
    if (error.message.includes("forbidden"))
      return { ok: false, error: "forbidden" };
    return { ok: false, error: error.message };
  }
  revalidatePath("/approvals");
  revalidatePath("/goods-receipts");
  revalidatePath("/inventory");
  return { ok: true };
}

export async function rejectGoodsReceipt(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .update({
      status: "rejected",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "notPending" };
  revalidatePath("/approvals");
  revalidatePath("/goods-receipts");
  return { ok: true };
}

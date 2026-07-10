"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { parseBahtToSatang } from "@/lib/money";
import { isProductCategory } from "@/lib/inventory";

export interface ProductFormState {
  ok: boolean;
  error?: string;
}

// manager/admin only. Returns the user when allowed, else null.
async function requireManager() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "manager") return null;
  return user;
}

function readProduct(formData: FormData) {
  const category = String(formData.get("category") ?? "");
  return {
    code: String(formData.get("code") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    category,
    unit: String(formData.get("unit") ?? "").trim() || "unit",
    cost: parseBahtToSatang(String(formData.get("cost") ?? "")) ?? 0,
    sell_price: parseBahtToSatang(String(formData.get("sell_price") ?? "")) ?? 0,
    safety_stock: Math.max(0, parseInt(String(formData.get("safety_stock") ?? "0"), 10) || 0),
    description: String(formData.get("description") ?? "").trim() || null,
    is_active: (formData.getAll("is_active").at(-1) ?? "true") !== "false",
  };
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };

  const input = readProduct(formData);
  if (!input.code || !input.name || !isProductCategory(input.category)) {
    return { ok: false, error: "required" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ ...input, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/inventory");
  redirect(`/inventory/${data.id}`);
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };

  const id = String(formData.get("id") ?? "");
  const input = readProduct(formData);
  if (!id || !input.code || !input.name || !isProductCategory(input.category)) {
    return { ok: false, error: "required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").update(input).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  redirect(`/inventory/${id}`);
}

export async function deleteProduct(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

export async function adjustStock(
  productId: string,
  qtyDelta: number,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireManager();
  if (!user) return { ok: false, error: "forbidden" };
  if (!productId || !Number.isInteger(qtyDelta) || qtyDelta === 0) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    product_id: productId,
    qty_delta: qtyDelta,
    reason: "adjustment",
    source_type: "adjustment",
    note: note.trim() || null,
    created_by: user.id,
  });

  if (error) {
    if (error.message.includes("insufficient_stock")) {
      return { ok: false, error: "insufficient" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/inventory");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { parseBahtToSatang } from "@/lib/money";

export interface CatalogResult {
  ok: boolean;
  error?: string;
}

async function adminClient() {
  await requireRole(["admin"]);
  return createClient();
}

export async function createCustomerType(values: {
  code: string;
  label_en: string;
  label_th: string;
}): Promise<CatalogResult> {
  try {
    const supabase = await adminClient();
    const code = values.code.trim().toLowerCase().replace(/\s+/g, "_");
    if (!code || !values.label_en.trim() || !values.label_th.trim()) {
      return { ok: false, error: "required" };
    }
    const { error } = await supabase.from("customer_types").insert({
      code,
      label_en: values.label_en.trim(),
      label_th: values.label_th.trim(),
      sort: 99,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings/catalog");
    return { ok: true };
  } catch {
    return { ok: false, error: "forbidden" };
  }
}

export async function updateCustomerType(
  id: string,
  values: { label_en: string; label_th: string }
): Promise<CatalogResult> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase
      .from("customer_types")
      .update({ label_en: values.label_en.trim(), label_th: values.label_th.trim() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings/catalog");
    return { ok: true };
  } catch {
    return { ok: false, error: "forbidden" };
  }
}

export async function deleteCustomerType(id: string): Promise<CatalogResult> {
  try {
    const supabase = await adminClient();
    const { error } = await supabase.from("customer_types").delete().eq("id", id);
    // FK restrict: a type still used by a customer cannot be deleted.
    if (error) return { ok: false, error: "inUse" };
    revalidatePath("/settings/catalog");
    return { ok: true };
  } catch {
    return { ok: false, error: "forbidden" };
  }
}

/** Save the 5 grade thresholds (in baht) for a basis. */
export async function saveGradeBands(
  basis: "annual" | "lifetime",
  bands: { grade: string; min_baht: string }[]
): Promise<CatalogResult> {
  try {
    const supabase = await adminClient();
    const rows = bands.map((b) => ({
      basis,
      grade: b.grade,
      min_satang: b.grade === "F" ? 0 : parseBahtToSatang(b.min_baht) ?? 0,
    }));
    const { error } = await supabase
      .from("grade_bands")
      .upsert(rows, { onConflict: "basis,grade" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings/catalog");
    revalidatePath("/customers");
    return { ok: true };
  } catch {
    return { ok: false, error: "forbidden" };
  }
}

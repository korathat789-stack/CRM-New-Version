"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { parseBahtToSatang } from "@/lib/money";

export interface ImportRow {
  name: string;
  tax_id?: string;
  province?: string;
  industry?: string;
  source?: string;
  annual_revenue?: string; // baht
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface ImportResult {
  ok: boolean;
  inserted: number;
  skipped: number;
  error?: string;
}

/** Bulk-create customers from parsed CSV rows. Admin only. */
export async function importCustomers(rows: ImportRow[]): Promise<ImportResult> {
  let user;
  try {
    user = await requireRole(["admin"]);
  } catch {
    return { ok: false, inserted: 0, skipped: 0, error: "forbidden" };
  }

  const supabase = await createClient();
  const valid = rows.filter((r) => r.name && r.name.trim());
  let inserted = 0;

  for (const r of valid) {
    const taxId = r.tax_id?.trim();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: r.name.trim(),
        tax_id: taxId && /^[0-9]{13}$/.test(taxId) ? taxId : null,
        province: r.province?.trim() || null,
        industry: r.industry?.trim() || null,
        source: r.source?.trim() || null,
        annual_revenue: parseBahtToSatang(r.annual_revenue ?? "") ?? 0,
        owner_id: user.id,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) continue;
    inserted += 1;

    if (r.contact_name?.trim()) {
      await supabase.from("contacts").insert({
        customer_id: data.id,
        name: r.contact_name.trim(),
        email: r.contact_email?.trim() || null,
        phone: r.contact_phone?.trim() || null,
        is_primary: true,
      });
    }
  }

  revalidatePath("/customers");
  return { ok: true, inserted, skipped: valid.length - inserted };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { findCustomerByTaxId } from "@/lib/customers";
import { parseBahtToSatang } from "@/lib/money";

export interface CustomerFormState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** set when a non-deleted customer already has this Tax ID */
  duplicate?: { code: string | null; name: string } | null;
  values?: Record<string, string>;
}

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  return {
    name: get("name"),
    tax_id: get("tax_id"),
    type_id: get("type_id"),
    province: get("province"),
    annual_revenue: get("annual_revenue"),
    lifetime_revenue: get("lifetime_revenue"),
    source: get("source"),
    industry: get("industry"),
    notes: get("notes"),
    address: get("address"),
    segment: get("segment"),
    buyer_role: get("buyer_role"),
    partner_name: get("partner_name"),
    contact_name: get("contact_name"),
    contact_email: get("contact_email"),
    contact_phone: get("contact_phone"),
    contact_line: get("contact_line"),
    allow_duplicate: get("allow_duplicate") === "true",
  };
}

function validate(input: ReturnType<typeof readForm>) {
  const fieldErrors: Record<string, string> = {};
  if (!input.name) fieldErrors.name = "required";
  if (!input.type_id) fieldErrors.type_id = "required";
  if (input.tax_id && !/^[0-9]{13}$/.test(input.tax_id)) {
    fieldErrors.tax_id = "taxId";
  }
  return fieldErrors;
}

function payload(input: ReturnType<typeof readForm>) {
  return {
    name: input.name,
    tax_id: input.tax_id || null,
    type_id: input.type_id || null,
    province: input.province || null,
    annual_revenue: parseBahtToSatang(input.annual_revenue) ?? 0,
    lifetime_revenue: parseBahtToSatang(input.lifetime_revenue) ?? 0,
    source: input.source || null,
    industry: input.industry || null,
    notes: input.notes || null,
    address: input.address || null,
    segment: input.segment === "project" || input.segment === "general" ? input.segment : null,
    buyer_role:
      input.buyer_role === "end_user" || input.buyer_role === "reseller"
        ? input.buyer_role
        : null,
    partner_name: input.partner_name || null,
  };
}

// Create or update the customer's primary contact from the form fields.
async function upsertPrimaryContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  input: ReturnType<typeof readForm>
) {
  if (!input.contact_name) return;
  const fields = {
    name: input.contact_name,
    email: input.contact_email || null,
    phone: input.contact_phone || null,
    line_id: input.contact_line || null,
    is_primary: true,
  };
  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("customer_id", customerId)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) {
    await supabase.from("contacts").update(fields).eq("id", existing.id);
  } else {
    await supabase.from("contacts").insert({ customer_id: customerId, ...fields });
  }
}

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const input = readForm(formData);
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values: input as never };
  }

  if (input.tax_id && !input.allow_duplicate) {
    const dup = await findCustomerByTaxId(input.tax_id);
    if (dup) {
      return {
        ok: false,
        duplicate: { code: dup.code, name: dup.name },
        values: input as never,
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...payload(input), owner_id: user.id, created_by: user.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message, values: input as never };

  await upsertPrimaryContact(supabase, data.id, input);

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(
  id: string,
  _prev: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const input = readForm(formData);
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values: input as never };
  }

  if (input.tax_id && !input.allow_duplicate) {
    const dup = await findCustomerByTaxId(input.tax_id, id);
    if (dup) {
      return {
        ok: false,
        duplicate: { code: dup.code, name: dup.name },
        values: input as never,
      };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update(payload(input))
    .eq("id", id);

  if (error) return { ok: false, error: error.message, values: input as never };

  await upsertPrimaryContact(supabase, id, input);

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

/** Soft delete: requires manager/admin + a typed-ID confirmation match. */
export async function deleteCustomer(id: string, typedCode: string) {
  const user = await requireRole(["admin", "manager"]);
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("code")
    .eq("id", id)
    .single();

  if (!customer || customer.code !== typedCode.trim()) {
    throw new Error("CONFIRM_MISMATCH");
  }

  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;

  await supabase.from("audit_log").insert({
    table_name: "customers",
    row_id: id,
    action: "soft_delete",
    actor_id: user.id,
  });

  revalidatePath("/customers");
  redirect("/customers");
}

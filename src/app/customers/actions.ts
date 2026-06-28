"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_STATUSES, type CustomerInput, type CustomerStatus } from "@/lib/types";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const v = (value ?? "").toString().trim();
  return v.length === 0 ? null : v;
}

function parseForm(formData: FormData): { data?: CustomerInput; error?: string } {
  const name = (formData.get("name") ?? "").toString().trim();
  if (!name) return { error: "Name is required." };

  const statusRaw = (formData.get("status") ?? "active").toString();
  const status = (CUSTOMER_STATUSES as string[]).includes(statusRaw)
    ? (statusRaw as CustomerStatus)
    : "active";

  return {
    data: {
      name,
      company: emptyToNull(formData.get("company")),
      email: emptyToNull(formData.get("email")),
      phone: emptyToNull(formData.get("phone")),
      status,
      address: emptyToNull(formData.get("address")),
      city: emptyToNull(formData.get("city")),
      country: emptyToNull(formData.get("country")),
      notes: emptyToNull(formData.get("notes")),
    },
  };
}

export async function createCustomer(formData: FormData) {
  const { data, error } = parseForm(formData);
  if (error || !data) throw new Error(error ?? "Invalid form data.");

  const supabase = await createClient();
  const { error: dbError } = await supabase.from("customers").insert(data);
  if (dbError) throw new Error(dbError.message);

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(id: string, formData: FormData) {
  const { data, error } = parseForm(formData);
  if (error || !data) throw new Error(error ?? "Invalid form data.");

  const supabase = await createClient();
  const { error: dbError } = await supabase
    .from("customers")
    .update(data)
    .eq("id", id);
  if (dbError) throw new Error(dbError.message);

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  const { error: dbError } = await supabase.from("customers").delete().eq("id", id);
  if (dbError) throw new Error(dbError.message);

  revalidatePath("/customers");
  redirect("/customers");
}

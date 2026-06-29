"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export interface ActivityResult {
  ok: boolean;
  error?: string;
}

export async function logActivity(values: {
  customerId: string;
  opportunityId?: string | null;
  type: string;
  summary: string;
  occurredAt: string;
  nextStep?: string;
  quotationNo?: string;
}): Promise<ActivityResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  if (!values.summary.trim()) return { ok: false, error: "required" };

  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    customer_id: values.customerId,
    opportunity_id: values.opportunityId || null,
    type: values.type || "note",
    summary: values.summary.trim(),
    occurred_at: values.occurredAt
      ? new Date(values.occurredAt).toISOString()
      : new Date().toISOString(),
    next_step: values.nextStep?.trim() || null,
    quotation_no: values.quotationNo?.trim() || null,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${values.customerId}`);
  if (values.opportunityId) revalidatePath(`/opportunities/${values.opportunityId}`);
  return { ok: true };
}

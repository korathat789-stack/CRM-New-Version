"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { getOpportunity } from "@/lib/opportunities";
import { evaluateGate } from "@/lib/gates";
import { isStageCode, type StageCode } from "@/lib/stages";
import { parseBahtToSatang } from "@/lib/money";

export interface AdvanceResult {
  ok: boolean;
  error?: string;
  /** unmet requirement keys when the gate blocks the advance */
  blockers?: string[];
}

/**
 * Advance an opportunity to `target`. Gates are re-evaluated SERVER-SIDE from
 * fresh data (never trust the client). If requirements are unmet the advance is
 * blocked unless `override` is set by a Manager/Admin.
 */
export async function advanceStage(
  id: string,
  target: string,
  override = false
): Promise<AdvanceResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  if (!isStageCode(target)) return { ok: false, error: "invalid" };

  const opp = await getOpportunity(id);
  if (!opp) return { ok: false, error: "notFound" };

  // "lost" has no gate; everything else is gated.
  if (target !== "lost") {
    const { met, missing } = evaluateGate(target as StageCode, opp.ctx);
    if (!met) {
      if (!override) {
        return { ok: false, blockers: missing.map((m) => m.key) };
      }
      // Override requires Manager/Admin.
      try {
        await requireRole(["admin", "manager"]);
      } catch {
        return { ok: false, error: "forbidden" };
      }
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("opportunities")
    .update({ stage: target })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Won → auto-create the linked project (wireframe T2).
  if (target === "won") {
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("opportunity_id", id)
      .limit(1)
      .maybeSingle();
    if (!existing) {
      await supabase.from("projects").insert({
        customer_id: opp.customer_id,
        opportunity_id: id,
        name: opp.title,
        stage: "won",
        value: opp.value,
      });
    }
  }

  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/opportunities");
  return { ok: true };
}

/** Manager/Admin sign-off required before Won. */
export async function authorizeOpportunity(id: string): Promise<AdvanceResult> {
  let me;
  try {
    me = await requireRole(["admin", "manager"]);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("opportunities")
    .update({ authorized_by: me.id, authorized_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/opportunities/${id}`);
  return { ok: true };
}

export async function updatePoc(
  id: string,
  values: { scheduled: string; result: string }
): Promise<AdvanceResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("opportunities")
    .update({
      poc_scheduled_at: values.scheduled || null,
      poc_result: values.result.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/opportunities/${id}`);
  return { ok: true };
}

/** Quick action: log a presentation activity (fills the → Quotation gate). */
export async function logPresentation(
  id: string,
  customerId: string
): Promise<AdvanceResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    opportunity_id: id,
    customer_id: customerId,
    type: "presentation",
    summary: "Presentation logged",
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/opportunities/${id}`);
  return { ok: true };
}

export async function createOpportunity(
  _prev: { ok: boolean; error?: string },
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const customerId = String(formData.get("customer_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!customerId || !title) return { ok: false, error: "required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      customer_id: customerId,
      title,
      value: parseBahtToSatang(String(formData.get("value") ?? "")) ?? 0,
      next_step: String(formData.get("next_step") ?? "").trim() || null,
      owner_id: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "saveFailed" };

  revalidatePath("/opportunities");
  redirect(`/opportunities/${data.id}`);
}

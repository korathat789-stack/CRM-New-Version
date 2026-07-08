"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { parseBahtToSatang } from "@/lib/money";
import { isStageCode } from "@/lib/stages";

export interface ProjectFormState {
  ok: boolean;
  error?: string;
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const customerId = String(formData.get("customer_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!customerId || !name) return { ok: false, error: "required" };

  const stageRaw = String(formData.get("stage") ?? "inquiry");
  const stage = isStageCode(stageRaw) ? stageRaw : "inquiry";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      customer_id: customerId,
      name,
      stage,
      value: parseBahtToSatang(String(formData.get("value") ?? "")) ?? 0,
      cost: parseBahtToSatang(String(formData.get("cost") ?? "")) ?? 0,
      budget: parseBahtToSatang(String(formData.get("budget") ?? "")) ?? 0,
      due_date: String(formData.get("due_date") ?? "") || null,
      est_date: String(formData.get("est_date") ?? "") || null,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "saveFailed" };

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

const FULFILLMENT = ["pending", "delivering", "installing", "closed"];

export async function updateFulfillment(
  id: string,
  status: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  if (!FULFILLMENT.includes(status)) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ fulfillment: status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

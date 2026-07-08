"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireRole } from "@/lib/auth";

export interface TaskResult {
  ok: boolean;
  error?: string;
}

export async function createTask(values: {
  title: string;
  priority: string;
  due_date: string;
  customer_id?: string | null;
}): Promise<TaskResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  if (!values.title.trim()) return { ok: false, error: "required" };

  const priority = ["high", "medium", "low"].includes(values.priority)
    ? values.priority
    : "medium";

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    title: values.title.trim(),
    priority,
    due_date: values.due_date || null,
    customer_id: values.customer_id || null,
    owner_id: user.id,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tasks");
  return { ok: true };
}

export async function toggleTask(id: string, done: boolean): Promise<TaskResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAuthenticated" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      status: done ? "done" : "open",
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

/** Hard delete — restricted to manager/admin by RLS and here. */
export async function deleteTask(id: string): Promise<TaskResult> {
  try {
    await requireRole(["admin", "manager"]);
  } catch {
    return { ok: false, error: "forbidden" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tasks");
  return { ok: true };
}

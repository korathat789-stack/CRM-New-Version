import { createClient } from "./supabase/server";

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "open" | "done";

export interface TaskItem {
  id: string;
  title: string;
  detail: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  customer_id: string | null;
  customer_name: string | null;
}

export async function listTasks(filter: "all" | "open" | "done" = "open"): Promise<TaskItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, title, detail, priority, status, due_date, customer_id, customers(name)")
    .is("deleted_at", null)
    .order("status")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (filter !== "all") query = query.eq("status", filter);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as unknown as TaskItem & { customers: { name: string } | null };
    return {
      id: row.id,
      title: row.title,
      detail: row.detail,
      priority: row.priority,
      status: row.status,
      due_date: row.due_date,
      customer_id: row.customer_id,
      customer_name: row.customers?.name ?? null,
    };
  });
}

/** Count of open tasks that are overdue — used by the dashboard notifications. */
export async function countOverdueTasks(now: Date = new Date()): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "open")
    .lt("due_date", now.toISOString().slice(0, 10));
  return count ?? 0;
}

export const PRIORITY_COLORS: Record<TaskPriority, { bg: string; fg: string }> = {
  high: { bg: "#fee2e2", fg: "#b91c1c" },
  medium: { bg: "#fef3c7", fg: "#b45309" },
  low: { bg: "#e2e8f0", fg: "#475569" },
};

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { createTask, toggleTask, deleteTask } from "@/app/(app)/tasks/actions";
import type { TaskItem, TaskPriority } from "@/lib/tasks";

const PRIORITY_COLORS: Record<TaskPriority, { bg: string; fg: string }> = {
  high: { bg: "#fee2e2", fg: "#b91c1c" },
  medium: { bg: "#fef3c7", fg: "#b45309" },
  low: { bg: "#e2e8f0", fg: "#475569" },
};

export function TasksManager({
  tasks,
  filter,
  canDelete,
}: {
  tasks: TaskItem[];
  filter: "all" | "open" | "done";
  canDelete: boolean;
}) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [due, setDue] = useState("");

  const setFilter = (f: string) => {
    const next = new URLSearchParams(params);
    next.set("filter", f);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const add = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await createTask({ title, priority, due_date: due });
      if (res.ok) {
        setTitle("");
        setDue("");
        toast(tc("saved"));
        router.refresh();
      }
    });
  };

  const onToggle = (id: string, done: boolean) =>
    startTransition(async () => {
      await toggleTask(id, done);
      router.refresh();
    });

  const onDelete = (id: string) =>
    startTransition(async () => {
      await deleteTask(id);
      router.refresh();
    });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="overflow-hidden">
      {/* Quick add */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("addPlaceholder")}
          className="input min-w-[180px] flex-1"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="input w-auto"
        >
          <option value="high">{t("priority.high")}</option>
          <option value="medium">{t("priority.medium")}</option>
          <option value="low">{t("priority.low")}</option>
        </select>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="input w-auto"
        />
        <Button onClick={add} disabled={pending || !title.trim()}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("add")}
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 border-b border-[var(--color-line-soft)] p-2 text-xs">
        {(["open", "done", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 font-semibold ${
              filter === f ? "bg-[var(--color-primary)] text-white" : "text-gray-500"
            }`}
          >
            {t(`filter.${f}`)}
          </button>
        ))}
      </div>

      {/* List */}
      {tasks.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">{t("noTasks")}</div>
      ) : (
        tasks.map((task) => {
          const done = task.status === "done";
          const overdue = !done && task.due_date && task.due_date < today;
          const pc = PRIORITY_COLORS[task.priority];
          return (
            <div
              key={task.id}
              className="flex items-center gap-2.5 border-b border-[var(--color-line-soft)] px-3 py-2.5 text-sm last:border-b-0"
            >
              <button
                onClick={() => onToggle(task.id, !done)}
                disabled={pending}
                aria-label="toggle"
                className={`flex h-5 w-5 items-center justify-center rounded border ${
                  done
                    ? "border-[#16a34a] bg-[#16a34a] text-white"
                    : "border-gray-300"
                }`}
              >
                {done && <Check className="h-3 w-3" aria-hidden />}
              </button>
              <span
                className="pill px-2 py-0.5 text-[10px] font-bold"
                style={{ background: pc.bg, color: pc.fg }}
              >
                {t(`priority.${task.priority}`)}
              </span>
              <span
                className={`min-w-0 flex-1 truncate ${done ? "text-gray-400 line-through" : "text-gray-900"}`}
              >
                {task.title}
                {task.customer_name && (
                  <Link
                    href={`/customers/${task.customer_id}`}
                    className="ml-2 text-[11px] text-[var(--color-primary)]"
                  >
                    {task.customer_name}
                  </Link>
                )}
              </span>
              <span className={`text-xs ${overdue ? "font-semibold text-[#dc2626]" : "text-gray-500"}`}>
                {task.due_date
                  ? `${task.due_date}${overdue ? ` · ${t("overdue")}` : ""}`
                  : t("noDue")}
              </span>
              {canDelete && (
                <button
                  onClick={() => onDelete(task.id)}
                  disabled={pending}
                  aria-label={t("delete")}
                  className="text-gray-300 hover:text-[#dc2626]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          );
        })
      )}
    </Card>
  );
}

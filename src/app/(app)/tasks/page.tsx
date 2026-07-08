import { getTranslations } from "next-intl/server";
import { TasksManager } from "@/components/tasks/TasksManager";
import { EmptyState } from "@/components/states/StateViews";
import { listTasks } from "@/lib/tasks";
import { isSupabaseConfigured } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { canDelete } from "@/lib/roles";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: filterParam } = await searchParams;
  const filter = (["all", "open", "done"].includes(filterParam ?? "")
    ? filterParam
    : "open") as "all" | "open" | "done";
  const t = await getTranslations("tasks");

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <div className="mt-4">
          <EmptyState />
        </div>
      </div>
    );
  }

  const [tasks, user] = await Promise.all([listTasks(filter), getCurrentUser()]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500">{t("subtitle", { count: tasks.length })}</p>
      </div>
      <TasksManager
        tasks={tasks}
        filter={filter}
        canDelete={user ? canDelete(user.role) : false}
      />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { UsersManager } from "@/components/users/UsersManager";
import { EmptyState } from "@/components/states/StateViews";
import { listUsers } from "@/lib/users";
import { isSupabaseConfigured } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";

export default async function UsersPage() {
  const t = await getTranslations("users");

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <div className="mt-4">
          <EmptyState />
        </div>
      </div>
    );
  }

  const [users, me] = await Promise.all([listUsers(), getCurrentUser()]);

  return (
    <div className="mx-auto max-w-4xl">
      <UsersManager users={users} currentUserId={me?.id ?? ""} />
    </div>
  );
}

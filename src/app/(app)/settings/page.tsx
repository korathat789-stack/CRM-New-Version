import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Users, Tags } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/settings/users">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-primary)] text-[var(--color-primary)]">
              <Users className="h-4 w-4" aria-hidden />
            </span>
            <div className="mt-2.5 font-bold text-gray-900">{t("usersCard")}</div>
            <div className="mt-0.5 text-xs text-gray-500">{t("usersDesc")}</div>
          </Card>
        </Link>
        <Link href="/settings/catalog">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-primary)] text-[var(--color-primary)]">
              <Tags className="h-4 w-4" aria-hidden />
            </span>
            <div className="mt-2.5 font-bold text-gray-900">{t("catalogCard")}</div>
            <div className="mt-0.5 text-xs text-gray-500">{t("catalogDesc")}</div>
          </Card>
        </Link>
      </div>
    </div>
  );
}

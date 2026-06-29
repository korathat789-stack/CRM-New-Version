import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TrendingUp, Wallet, Receipt, PieChart } from "lucide-react";
import { Card } from "@/components/ui/Card";

const REPORTS = [
  { href: "/reports/sales", key: "sales", icon: TrendingUp },
  { href: "/reports/cost", key: "cost", icon: Wallet },
  { href: "/reports/accounting", key: "accounting", icon: Receipt },
  { href: "/reports/pnl", key: "pnl", icon: PieChart },
] as const;

export default async function ReportsHubPage() {
  const t = await getTranslations("reports");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500">{t("hubSubtitle")}</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REPORTS.map(({ href, key, icon: Icon }) => (
          <Link key={key} href={href}>
            <Card className="p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-primary)] text-[var(--color-primary)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="pill bg-[#dcfce7] px-2 py-0.5 text-[10px] font-medium text-[#15803d]">
                  {t("ready")}
                </span>
              </div>
              <div className="mt-2.5 font-bold text-gray-900">
                {t(`hub.${key}.title`)}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {t(`hub.${key}.desc`)}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

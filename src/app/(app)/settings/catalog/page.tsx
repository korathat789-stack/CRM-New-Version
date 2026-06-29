import { getTranslations } from "next-intl/server";
import { CatalogManager } from "@/components/settings/CatalogManager";
import { EmptyState } from "@/components/states/StateViews";
import { getCustomerTypes, getGradeBands, isSupabaseConfigured } from "@/lib/config";
import { ALL_GRADES, type GradeBand } from "@/lib/grade";
import { satangToBaht } from "@/lib/money";

function toRows(bands: GradeBand[]) {
  const byGrade = new Map(bands.map((b) => [b.grade, b.min]));
  return ALL_GRADES.map((g) => ({
    grade: g,
    min_baht: String(Math.round(satangToBaht(byGrade.get(g) ?? 0))),
  }));
}

export default async function CatalogPage() {
  const t = await getTranslations("settings.catalog");

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

  const [types, annual, lifetime] = await Promise.all([
    getCustomerTypes(),
    getGradeBands("annual"),
    getGradeBands("lifetime"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-xl font-bold text-gray-900">{t("title")}</h1>
      <CatalogManager
        types={types}
        annualBands={toRows(annual)}
        lifetimeBands={toRows(lifetime)}
      />
    </div>
  );
}

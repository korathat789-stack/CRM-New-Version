import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StageBadge } from "@/components/ui/StageBadge";
import { EmptyState } from "@/components/states/StateViews";
import { listOpportunities } from "@/lib/opportunities";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBahtShort } from "@/lib/money";

const GRID = "grid grid-cols-[2fr_1.4fr_1fr_1fr_1.6fr] gap-2 items-center";

export default async function OpportunitiesPage() {
  const t = await getTranslations("opportunities");

  const header = (count?: number) => (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex-1">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        {count !== undefined && (
          <p className="text-sm text-gray-500">{t("subtitle", { count })}</p>
        )}
      </div>
      <Link href="/opportunities/new">
        <Button>
          <Plus className="h-4 w-4" aria-hidden />
          {t("newOpportunity")}
        </Button>
      </Link>
    </div>
  );

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-5xl">
        {header()}
        <div className="mt-4">
          <EmptyState />
        </div>
      </div>
    );
  }

  const rows = await listOpportunities();

  return (
    <div className="mx-auto max-w-5xl">
      {header(rows.length)}
      <Card className="mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {t("noOpportunities")}
          </div>
        ) : (
          <>
            <div className={`${GRID} border-b border-[var(--color-line)] bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-500`}>
              <div>{t("cols.title")}</div>
              <div>{t("cols.customer")}</div>
              <div>{t("cols.stage")}</div>
              <div className="text-right">{t("cols.value")}</div>
              <div>{t("cols.nextStep")}</div>
            </div>
            {rows.map((o) => (
              <Link
                key={o.id}
                href={`/opportunities/${o.id}`}
                className={`${GRID} border-b border-[var(--color-line-soft)] px-4 py-2.5 text-xs hover:bg-gray-50`}
              >
                <div>
                  <div className="font-semibold text-gray-900">{o.title}</div>
                  <div className="text-[11px] text-gray-400">{o.code}</div>
                </div>
                <div className="text-gray-700">{o.customer_name ?? "—"}</div>
                <div>
                  <StageBadge code={o.stage} />
                </div>
                <div className="text-right font-bold text-gray-900">
                  {formatBahtShort(o.value)}
                </div>
                <div className="truncate text-gray-500">{o.next_step ?? "—"}</div>
              </Link>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}

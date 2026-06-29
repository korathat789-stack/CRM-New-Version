import { getTranslations } from "next-intl/server";
import { Card, CardBody } from "@/components/ui/Card";
import { Kpi } from "@/components/reports/ui";
import { getCostReport } from "@/lib/reports";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBahtShort } from "@/lib/money";

const GRID = "grid grid-cols-[2fr_1fr_1fr_1.1fr_1.2fr] gap-2 items-center";

export default async function CostReportPage() {
  const t = await getTranslations("reports.cost");

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <Card className="mt-4 p-8 text-center text-sm text-gray-500">—</Card>
      </div>
    );
  }

  const r = await getCostReport();
  const green = "#16a34a";
  const red = "#dc2626";

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--color-line-soft)] p-4 sm:grid-cols-4">
          <Kpi label={t("kpi.totalBudget")} value={formatBahtShort(r.totalBudget)} />
          <Kpi label={t("kpi.actualCost")} value={formatBahtShort(r.totalActual)} />
          <Kpi
            label={t("kpi.variance")}
            value={formatBahtShort(r.variance)}
            color={r.variance >= 0 ? green : red}
          />
          <Kpi label={t("kpi.overBudget")} value={`${r.overCount} / ${r.count}`} />
        </div>

        <CardBody>
          <div className={`${GRID} border-b border-[var(--color-line)] pb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500`}>
            <div>{t("project")}</div>
            <div className="text-right">{t("budget")}</div>
            <div className="text-right">{t("actual")}</div>
            <div className="text-right">{t("varianceCol")}</div>
            <div>{t("used")}</div>
          </div>
          {r.rows.map((p, i) => (
            <div
              key={i}
              className={`${GRID} border-b border-[var(--color-line-soft)] py-2.5 text-xs text-gray-700`}
            >
              <div className="text-gray-900">{p.name}</div>
              <div className="text-right">{formatBahtShort(p.budget)}</div>
              <div className="text-right">{formatBahtShort(p.actual)}</div>
              <div
                className="text-right"
                style={{ color: p.variance >= 0 ? green : red }}
              >
                {formatBahtShort(p.variance)}
              </div>
              <div>
                <div className="h-1.5 rounded bg-[#e2e8f0]">
                  <div
                    className="h-1.5 rounded"
                    style={{
                      width: `${p.usedPct}%`,
                      background: p.over ? red : green,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          <div className={`${GRID} pt-2.5 text-xs font-bold text-gray-900`}>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              {t("total", { count: r.count })}
            </div>
            <div className="text-right">{formatBahtShort(r.totalBudget)}</div>
            <div className="text-right">{formatBahtShort(r.totalActual)}</div>
            <div
              className="text-right"
              style={{ color: r.variance >= 0 ? green : red }}
            >
              {formatBahtShort(r.variance)}
            </div>
            <div />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

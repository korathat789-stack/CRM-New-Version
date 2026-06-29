import { getTranslations } from "next-intl/server";
import { Card, CardBody } from "@/components/ui/Card";
import { Kpi, Panel } from "@/components/reports/ui";
import { StageBarChart } from "@/components/reports/charts";
import { EstimateToggle } from "@/components/reports/EstimateToggle";
import { getSalesReport } from "@/lib/reports";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBahtShort } from "@/lib/money";
import { STAGES } from "@/lib/stages";

export default async function SalesReportPage() {
  const t = await getTranslations("reports.sales");
  const ts = await getTranslations();

  if (!isSupabaseConfigured()) {
    return <Empty title={t("title")} />;
  }

  const r = await getSalesReport();
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const stageData = r.byStage.map((s) => ({
    name: ts(STAGES[s.stage].labelKey),
    value: s.value,
    color: STAGES[s.stage].fg,
  }));
  const maxOwner = Math.max(r.target, ...r.byOwner.map((o) => o.won), 1);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--color-line-soft)] p-4 sm:grid-cols-5">
          <Kpi label={t("kpi.booked")} value={formatBahtShort(r.booked)} />
          <Kpi label={t("kpi.target")} value={formatBahtShort(r.target)} />
          <Kpi label={t("kpi.attainment")} value={pct(r.attainment)} color="#d97706" />
          <Kpi label={t("kpi.winRate")} value={pct(r.winRate)} />
          <Kpi label={t("kpi.pipeline")} value={formatBahtShort(r.pipeline)} />
        </div>

        <CardBody className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <Panel title={t("byOwner")}>
            <div className="flex flex-col gap-2.5">
              {r.byOwner.length === 0 ? (
                <div className="text-xs text-gray-400">{t("noWon")}</div>
              ) : (
                r.byOwner.map((o) => (
                  <div key={o.name}>
                    <div className="mb-1 flex justify-between text-[11px] text-gray-700">
                      <span>{o.name}</span>
                      <span>{formatBahtShort(o.won)}</span>
                    </div>
                    <div className="h-2 rounded bg-[#e2e8f0]">
                      <div
                        className="h-2 rounded bg-[var(--color-primary)]"
                        style={{ width: `${Math.min(100, (o.won / maxOwner) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title={t("byStage")}>
            <StageBarChart data={stageData} />
          </Panel>

          <Panel title={t("estimate")} className="lg:col-span-2">
            <EstimateToggle
              quotation={r.estimate.quotation}
              invoice={r.estimate.invoice}
              combined={r.estimate.combined}
              openQuotes={r.estimate.openQuotes}
            />
          </Panel>

          <Panel title={t("closedWon")} className="lg:col-span-2">
            {r.closedWon.length === 0 ? (
              <div className="text-xs text-gray-400">{t("noWon")}</div>
            ) : (
              <div>
                <div className="grid grid-cols-[2fr_1.3fr_1fr_0.9fr] gap-2 border-b border-[var(--color-line-soft)] pb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  <div>{t("deal")}</div>
                  <div>{t("customer")}</div>
                  <div className="text-right">{t("value")}</div>
                  <div>{t("owner")}</div>
                </div>
                {r.closedWon.map((d, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[2fr_1.3fr_1fr_0.9fr] gap-2 border-b border-[var(--color-line-soft)] py-1.5 text-xs text-gray-700 last:border-b-0"
                  >
                    <div className="text-gray-900">{d.title}</div>
                    <div>{d.customer ?? "—"}</div>
                    <div className="text-right font-bold">{formatBahtShort(d.value)}</div>
                    <div>{d.owner ?? "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </CardBody>
      </Card>
    </div>
  );
}

function Empty({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <Card className="mt-4 p-8 text-center text-sm text-gray-500">—</Card>
    </div>
  );
}

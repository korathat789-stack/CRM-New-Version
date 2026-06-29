import { getTranslations } from "next-intl/server";
import { Card, CardBody } from "@/components/ui/Card";
import { PnlViewToggle } from "@/components/reports/PnlViewToggle";
import { TrendBarChart } from "@/components/reports/charts";
import { getPnlReport, type PnlRow } from "@/lib/reports";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBahtShort } from "@/lib/money";
import { formatMarginPct } from "@/lib/margin";

export default async function PnlReportPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view: "month" | "quarter" = viewParam === "month" ? "month" : "quarter";
  const t = await getTranslations("reports.pnl");

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <Card className="mt-4 p-8 text-center text-sm text-gray-500">—</Card>
      </div>
    );
  }

  const r = await getPnlReport();
  const columns = view === "month" ? [...r.months, r.total] : [r.total];
  // Dynamic column count → inline grid template (Tailwind can't JIT runtime classes).
  const GRIDC = "grid gap-2 items-center";
  const gridStyle = {
    gridTemplateColumns: `1.8fr repeat(${columns.length}, 1fr)`,
  };
  const trend = r.months.map((m) => ({
    label: m.label,
    revenue: m.revenue,
    net: m.net,
  }));

  const line = (
    label: string,
    pick: (row: PnlRow) => number,
    opts?: { bold?: boolean; muted?: boolean; color?: string; highlight?: boolean }
  ) => (
    <div
      className={`${GRIDC} py-2 text-xs ${opts?.highlight ? "bg-gray-50" : ""} border-b border-[var(--color-line-soft)]`}
      style={gridStyle}
    >
      <div className={opts?.muted ? "text-gray-500" : "text-gray-900"}>{label}</div>
      {columns.map((c, i) => (
        <div
          key={i}
          className={`text-right ${opts?.bold ? "font-bold" : ""}`}
          style={opts?.color ? { color: opts.color } : undefined}
        >
          {formatBahtShort(pick(c))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <PnlViewToggle view={view} />
      </div>

      <Card className="mt-4">
        <CardBody>
          {/* header */}
          <div
            className={`${GRIDC} border-b border-[var(--color-line)] pb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500`}
            style={gridStyle}
          >
            <div />
            {columns.map((c, i) => (
              <div key={i} className="text-right">
                {c.label}
              </div>
            ))}
          </div>

          {line(t("revenue"), (c) => c.revenue, { color: "#111827" })}
          {line(t("cogs"), (c) => c.cogs, { muted: true })}
          {line(t("gross"), (c) => c.gross, { bold: true, color: "#16a34a", highlight: true })}
          {line(t("opex"), (c) => c.opex, { muted: true })}
          {line(t("ebit"), (c) => c.ebit, { bold: true })}
          {line(t("tax"), (c) => c.tax, { muted: true })}

          <div className={`${GRIDC} py-2.5`} style={gridStyle}>
            <div className="font-bold text-gray-900">{t("net")}</div>
            {columns.map((c, i) => (
              <div key={i} className="text-right text-base font-bold text-[#16a34a]">
                {formatBahtShort(c.net)}
              </div>
            ))}
          </div>
          <div className={`${GRIDC} text-[11px] text-gray-400`} style={gridStyle}>
            <div>{t("netMargin")}</div>
            {columns.map((c, i) => (
              <div key={i} className="text-right">
                {formatMarginPct(c.margin)}
              </div>
            ))}
          </div>

          {trend.length > 0 && (
            <div className="mt-4">
              <TrendBarChart
                data={trend}
                revenueLabel={t("legendRevenue")}
                netLabel={t("legendNet")}
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

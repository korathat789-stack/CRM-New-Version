import { getTranslations } from "next-intl/server";
import { Card, CardBody } from "@/components/ui/Card";
import { Kpi } from "@/components/reports/ui";
import { getAccountingReport } from "@/lib/reports";
import { isSupabaseConfigured } from "@/lib/config";
import { QUOTATION_STATUS_COLORS } from "@/lib/quotations";
import { formatBahtShort } from "@/lib/money";

const GRID = "grid grid-cols-[1.2fr_1.5fr_1fr_0.9fr_1fr] gap-2 items-center";

export default async function AccountingReportPage() {
  const t = await getTranslations("reports.accounting");
  const ts = await getTranslations();

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <Card className="mt-4 p-8 text-center text-sm text-gray-500">—</Card>
      </div>
    );
  }

  const r = await getAccountingReport();

  const buckets: { key: keyof typeof r.aging; danger?: boolean }[] = [
    { key: "current" },
    { key: "d1_30" },
    { key: "d31_60" },
    { key: "d60plus", danger: true },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--color-line-soft)] p-4 sm:grid-cols-4">
          <Kpi label={t("kpi.invoiced")} value={formatBahtShort(r.invoiced)} />
          <Kpi label={t("kpi.received")} value={formatBahtShort(r.received)} color="#16a34a" />
          <Kpi label={t("kpi.outstanding")} value={formatBahtShort(r.outstanding)} />
          <Kpi label={t("kpi.overdue")} value={formatBahtShort(r.overdue)} color="#dc2626" />
        </div>

        {/* AR aging */}
        <div className="flex flex-wrap gap-2.5 border-b border-[var(--color-line-soft)] p-4">
          {buckets.map((b) => (
            <div
              key={b.key}
              className={`flex-1 rounded-md border border-dashed p-2.5 text-center ${
                b.danger ? "border-[#fecaca] bg-[#fef2f2]" : "border-gray-300"
              }`}
            >
              <div className={`text-[10px] ${b.danger ? "text-[#b91c1c]" : "text-gray-500"}`}>
                {t(`aging.${b.key}`)}
              </div>
              <div
                className="text-sm font-bold"
                style={{ color: b.danger ? "#dc2626" : "var(--color-ink)" }}
              >
                {formatBahtShort(r.aging[b.key])}
              </div>
            </div>
          ))}
        </div>

        <CardBody>
          {r.rows.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              {t("noInvoices")}
            </div>
          ) : (
            <>
              <div className={`${GRID} border-b border-[var(--color-line)] pb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500`}>
                <div>{t("quotation")}</div>
                <div>{t("customer")}</div>
                <div className="text-right">{t("amount")}</div>
                <div>{t("due")}</div>
                <div>{t("status")}</div>
              </div>
              {r.rows.map((inv, i) => {
                const color =
                  QUOTATION_STATUS_COLORS[inv.status] ??
                  QUOTATION_STATUS_COLORS.sent;
                return (
                  <div
                    key={i}
                    className={`${GRID} border-b border-[var(--color-line-soft)] py-2.5 text-xs text-gray-700 last:border-b-0`}
                  >
                    <div className="font-semibold text-gray-900">{inv.number}</div>
                    <div>{inv.customer ?? "—"}</div>
                    <div className="text-right font-bold">{formatBahtShort(inv.amount)}</div>
                    <div>
                      {inv.due_date
                        ? new Date(inv.due_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </div>
                    <div>
                      <span
                        className="pill inline-flex px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: color.bg, color: color.fg }}
                      >
                        {ts(`quotations.status.${inv.status}`)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

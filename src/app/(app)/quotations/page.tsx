import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/states/StateViews";
import { listQuotations, QUOTATION_STATUS_COLORS } from "@/lib/quotations";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBahtShort } from "@/lib/money";

export default async function QuotationsPage() {
  const t = await getTranslations("quotations");

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex-1">
        <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
      </div>
      <Link href="/quotations/new">
        <Button>
          <Plus className="h-4 w-4" aria-hidden />
          {t("newQuotation")}
        </Button>
      </Link>
    </div>
  );

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-5xl">
        {header}
        <div className="mt-4">
          <EmptyState />
        </div>
      </div>
    );
  }

  const rows = await listQuotations();

  return (
    <div className="mx-auto max-w-5xl">
      {header}
      <Card className="mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {t("noQuotations")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1.2fr_1.6fr_1fr_0.9fr_1fr_auto] gap-2 border-b border-[var(--color-line)] bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <div>{t("cols.number")}</div>
              <div>{t("cols.customer")}</div>
              <div className="text-right">{t("cols.total")}</div>
              <div>{t("cols.date")}</div>
              <div>{t("cols.status")}</div>
              <div className="sr-only">{t("download")}</div>
            </div>
            {rows.map((r) => {
              const color =
                QUOTATION_STATUS_COLORS[r.status] ??
                QUOTATION_STATUS_COLORS.draft;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.2fr_1.6fr_1fr_0.9fr_1fr_auto] items-center gap-2 border-b border-[var(--color-line-soft)] px-4 py-2.5 text-xs"
                >
                  <div className="font-semibold text-gray-900">{r.number}</div>
                  <div className="text-gray-700">{r.customer_name ?? "—"}</div>
                  <div className="text-right font-bold text-gray-900">
                    {formatBahtShort(r.total)}
                  </div>
                  <div className="text-gray-500">
                    {new Date(r.quotation_date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </div>
                  <div>
                    <span
                      className="pill inline-flex px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: color.bg, color: color.fg }}
                    >
                      {t(`status.${r.status}`)}
                    </span>
                  </div>
                  <a
                    href={`/quotations/${r.id}/pdf`}
                    download
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)] hover:bg-blue-50"
                    aria-label={t("download")}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    {t("download")}
                  </a>
                </div>
              );
            })}
          </>
        )}
      </Card>
    </div>
  );
}

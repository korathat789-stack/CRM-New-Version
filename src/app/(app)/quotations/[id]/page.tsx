import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardBody } from "@/components/ui/Card";
import { getQuotation, QUOTATION_STATUS_COLORS } from "@/lib/quotations";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBaht } from "@/lib/money";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();

  const q = await getQuotation(id);
  if (!q) notFound();

  const t = await getTranslations("quotations");
  const tf = await getTranslations("quotations.form");
  const td = await getTranslations("quotations.detail");
  const color = QUOTATION_STATUS_COLORS[q.status] ?? QUOTATION_STATUS_COLORS.draft;
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] p-4">
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-gray-900">{q.number}</div>
            <Link href={`/customers/${q.customer_id}`} className="text-xs text-[var(--color-primary)]">
              {q.customer_name} · {q.customer_code} ↗
            </Link>
          </div>
          <span
            className="pill inline-flex px-2.5 py-0.5 text-[11px] font-medium"
            style={{ background: color.bg, color: color.fg }}
          >
            {t(`status.${q.status}`)}
          </span>
        </div>

        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={td("date")} value={fmtDate(q.quotation_date)} />
            <Field label={td("expiring")} value={fmtDate(q.expiring_date)} />
            <Field label={td("creditTerm")} value={q.credit_term ? `${q.credit_term} ${td("days")}` : "—"} />
          </div>

          {/* Line items */}
          <div className="overflow-hidden rounded-md border border-[var(--color-line)]">
            <div className="grid grid-cols-[0.4fr_2.4fr_1.2fr_0.6fr_0.8fr_1.2fr] gap-2 bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <div>{tf("lineNo")}</div>
              <div>{tf("description")}</div>
              <div className="text-right">{tf("unitPrice")}</div>
              <div className="text-right">{tf("qty")}</div>
              <div className="text-right">{tf("discount")}</div>
              <div className="text-right">{tf("amount")}</div>
            </div>
            {q.items.map((it) => (
              <div
                key={it.line_no}
                className="grid grid-cols-[0.4fr_2.4fr_1.2fr_0.6fr_0.8fr_1.2fr] items-center gap-2 border-b border-[var(--color-line-soft)] px-3 py-2 text-xs last:border-b-0"
              >
                <div className="text-gray-400">{it.line_no}</div>
                <div className="text-gray-900">{it.description}</div>
                <div className="text-right text-gray-700">{formatBaht(it.unit_price)}</div>
                <div className="text-right text-gray-700">{it.qty}</div>
                <div className="text-right text-gray-700">{it.discount_pct}%</div>
                <div className="text-right font-bold text-gray-900">{formatBaht(it.amount)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="flex w-full max-w-xs flex-col gap-2 text-xs text-gray-700">
              <Row label={tf("subtotal")} value={formatBaht(q.subtotal)} />
              <Row label={`${tf("vat", { rate: 7 })}`} value={formatBaht(q.vat_amount)} />
              <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-2">
                <span className="text-sm font-bold text-gray-900">{tf("total")}</span>
                <b className="text-lg text-[var(--color-primary)]">{formatBaht(q.total)}</b>
              </div>
            </div>
          </div>

          {(q.remark || q.terms) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {q.remark && <Note label={tf("remark")} value={q.remark} />}
              {q.terms && <Note label={tf("terms")} value={q.terms} />}
            </div>
          )}

          <Link href="/quotations" className="text-xs font-semibold text-gray-500">
            ← {td("back")}
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Note({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-line-soft)] p-3">
      <div className="mb-1 text-[11px] font-semibold text-gray-500">{label}</div>
      <div className="whitespace-pre-wrap text-xs text-gray-700">{value}</div>
    </div>
  );
}

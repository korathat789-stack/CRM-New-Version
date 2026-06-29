import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StageBadge } from "@/components/ui/StageBadge";
import { FulfillmentEditor } from "@/components/projects/FulfillmentEditor";
import { getProject } from "@/lib/projects";
import { isSupabaseConfigured } from "@/lib/config";
import { formatBahtShort } from "@/lib/money";
import { marginTone, marginToneColor, formatMarginPct } from "@/lib/margin";

export default async function ProjectInsightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();

  const p = await getProject(id);
  if (!p) notFound();

  const t = await getTranslations("projects.insight");
  const marginColor = marginToneColor(marginTone(p.margin_pct));

  // Cost / margin split of the value bar (guard ÷0 when value = 0).
  const value = p.value;
  const costPct = value > 0 ? Math.min(100, (p.cost / value) * 100) : 0;
  const marginBarPct = value > 0 ? Math.max(0, 100 - costPct) : 0;

  const slipDays = slip(p.due_date, p.est_date);

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <div className="flex items-start justify-between gap-2 border-b border-[var(--color-line)] p-4">
          <div>
            <div className="text-base font-bold text-gray-900">{p.name}</div>
            <div className="text-xs text-gray-500">
              {p.code} ·{" "}
              <Link
                href={`/customers/${p.customer_id}`}
                className="text-[var(--color-primary)]"
              >
                {p.customer_name} ↩
              </Link>
            </div>
          </div>
          <StageBadge code={p.stage} />
        </div>

        <CardBody className="flex flex-col gap-3.5">
          {/* Value · cost · margin */}
          <Panel title={t("valueCostMargin")}>
            <div className="mb-2 flex h-[18px] overflow-hidden rounded-[5px]">
              <div
                className="flex items-center pl-2 text-[10px] font-semibold text-slate-700"
                style={{ width: `${costPct}%`, background: "#cbd5e1" }}
              >
                {t("cost")} {formatBahtShort(p.cost)}
              </div>
              <div
                className="flex items-center pl-2 text-[10px] font-semibold text-white"
                style={{ width: `${marginBarPct}%`, background: marginColor }}
              >
                {formatBahtShort(p.margin_amount)}
              </div>
            </div>
            <Row label={t("value")} value={formatBahtShort(p.value)} />
            <Row
              label={t("margin")}
              value={`${formatMarginPct(p.margin_pct)} · ${formatBahtShort(p.margin_amount)}`}
              valueColor={marginColor}
            />
          </Panel>

          {/* Timeline */}
          <Panel title={t("timeline")}>
            <Row label={t("dueDate")} value={fmtDate(p.due_date)} />
            <Row
              label={t("estClose")}
              value={
                slipDays > 0
                  ? `${fmtDate(p.est_date)} · ${t("slip", { days: slipDays })}`
                  : `${fmtDate(p.est_date)} · ${t("onTrack")}`
              }
              valueColor={slipDays > 0 ? "#d97706" : undefined}
            />
          </Panel>

          <FulfillmentEditor id={p.id} value={p.fulfillment} />

          {/* Linked records */}
          <div className="rounded-md border border-dashed border-[var(--color-primary)] bg-blue-50 p-3">
            <div className="mb-2 text-xs font-bold text-[var(--color-primary)]">
              {t("linkedRecords")}
            </div>
            <LinkRow
              label={`${t("customer")} · ${p.customer_name ?? ""}`}
              href={`/customers/${p.customer_id}`}
              action={`↗ ${t("view360")}`}
            />
            {p.opportunity_code && (
              <LinkRow
                label={`${t("opportunity")} · ${p.opportunity_code}`}
                href="/opportunities"
              />
            )}
            {p.quotation_number && (
              <LinkRow
                label={`${t("quotation")} · ${p.quotation_number}`}
                href="/quotations"
              />
            )}
          </div>

          <div className="flex justify-between">
            <Link
              href="/projects"
              className="text-xs font-semibold text-gray-500"
            >
              ← {t("backToList")}
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-gray-300 p-3">
      <div className="mb-2.5 text-xs font-bold text-gray-600">{title}</div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between text-xs text-gray-700">
      <span className="text-gray-500">{label}</span>
      <b style={valueColor ? { color: valueColor } : undefined}>{value}</b>
    </div>
  );
}

function LinkRow({
  label,
  href,
  action,
}: {
  label: string;
  href: string;
  action?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-1 text-xs text-gray-700"
    >
      <span>{label}</span>
      <span className="inline-flex items-center gap-0.5 text-[var(--color-primary)]">
        {action ?? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
      </span>
    </Link>
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function slip(due: string | null, est: string | null): number {
  if (!due || !est) return 0;
  const ms = new Date(est).getTime() - new Date(due).getTime();
  return Math.round(ms / 86400000);
}

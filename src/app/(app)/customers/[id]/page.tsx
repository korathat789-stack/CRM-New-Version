import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Phone, Mail, MessageCircle, Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { StageBadge } from "@/components/ui/StageBadge";
import { GradeBasisToggle } from "@/components/customers/GradeBasisToggle";
import { DeleteCustomerDialog } from "@/components/customers/DeleteCustomerDialog";
import { getCustomer } from "@/lib/customers";
import { isSupabaseConfigured } from "@/lib/config";
import { gradeForCustomer, type GradeBasis } from "@/lib/grade";
import { formatBahtShort } from "@/lib/money";

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ basis?: string }>;
}) {
  const { id } = await params;
  const { basis: basisParam } = await searchParams;
  if (!isSupabaseConfigured()) notFound();

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const t = await getTranslations("customers");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const basis: GradeBasis = basisParam === "lifetime" ? "lifetime" : "annual";
  const grade = gradeForCustomer(customer, basis);

  const typeLabel = customer.type
    ? locale === "th"
      ? customer.type.label_th
      : customer.type.label_en
    : null;
  const fmtDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";
  const winRate =
    customer.win_rate == null
      ? "—"
      : `${Math.round(customer.win_rate * 100)}%`;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] p-4">
          <GradeBadge grade={grade} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-gray-900">
              {customer.name}
            </div>
            <div className="truncate text-xs text-gray-500">
              {customer.code}
              {typeLabel ? ` · ${typeLabel}` : ""}
              {customer.province ? ` · ${customer.province}` : ""}
            </div>
          </div>
          <GradeBasisToggle basis={basis} />
          <div className="flex gap-2">
            <Link href={`/customers/${customer.id}/edit`}>
              <Button variant="outline">{tc("edit")}</Button>
            </Link>
            <DeleteCustomerDialog
              id={customer.id}
              code={customer.code ?? ""}
              name={customer.name}
            />
            <Button disabled title={tc("comingSoon")}>
              <Plus className="h-4 w-4" aria-hidden />
              {t("addActivity")}
            </Button>
          </div>
        </div>

        {/* KPI strip (variant B) */}
        <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--color-line-soft)] p-4 sm:grid-cols-4">
          <Kpi label={t("insight.lifetimeRevenue")} value={formatBahtShort(customer.lifetime_revenue)} />
          <Kpi label={t("insight.openPipeline")} value={formatBahtShort(customer.open_pipeline)} />
          <Kpi label={t("insight.winRate")} value={winRate} />
          <Kpi label={t("insight.openOpps")} value={String(customer.open_opportunities)} />
        </div>

        {/* Two-column body */}
        <div className="flex flex-col gap-4 p-4 lg:flex-row">
          {/* Left insight column */}
          <div className="flex w-full flex-col gap-3 lg:w-[230px]">
            <Panel title={t("insight.title")}>
              <Row label={t("insight.lifetimeRevenue")} value={formatBahtShort(customer.lifetime_revenue)} />
              <Row label={t("insight.openPipeline")} value={formatBahtShort(customer.open_pipeline)} />
              <Row label={t("insight.winRate")} value={winRate} />
              <Row label={t("insight.lastActivity")} value={fmtDate(customer.last_activity_at)} />
            </Panel>

            <Panel title={t("details.title")}>
              <Row label={t("details.taxId")} value={customer.tax_id ?? "—"} />
              <Row label={t("details.owner")} value={customer.owner_name ?? "—"} />
              <Row label={t("details.type")} value={typeLabel ?? "—"} />
              <Row label={t("details.created")} value={fmtDate(customer.created_at)} />
            </Panel>

            <Panel title={t("contact.title")}>
              {customer.primary_contact ? (
                <div>
                  <div className="text-xs font-semibold text-gray-900">
                    {customer.primary_contact.name}
                  </div>
                  {customer.primary_contact.title && (
                    <div className="text-[11px] text-gray-500">
                      {customer.primary_contact.title}
                    </div>
                  )}
                  <div className="mt-2 flex gap-3 text-[11px] text-[var(--color-primary)]">
                    {customer.primary_contact.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" aria-hidden />
                        {t("contact.call")}
                      </span>
                    )}
                    {customer.primary_contact.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" aria-hidden />
                        {t("contact.email")}
                      </span>
                    )}
                    {customer.primary_contact.line_id && (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" aria-hidden />
                        {t("contact.line")}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400">{t("contact.none")}</div>
              )}
            </Panel>
          </div>

          {/* Right column */}
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex gap-1 border-b border-[var(--color-line)] text-xs">
              <span className="border-b-2 border-[var(--color-primary)] px-2.5 py-1.5 font-semibold text-[var(--color-primary)]">
                {t("tabs.overview")}
              </span>
              <span className="px-2.5 py-1.5 text-gray-400">{t("tabs.projects")}</span>
              <span className="px-2.5 py-1.5 text-gray-400">{t("tabs.opportunities")}</span>
              <span className="px-2.5 py-1.5 text-gray-400">{t("tabs.activity")}</span>
            </div>

            <div className="mb-1.5 text-xs font-bold text-gray-600">
              {t("linkedProjects")}
            </div>
            {customer.projects.length === 0 ? (
              <div className="mb-4 rounded-md border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
                {t("noProjects")}
              </div>
            ) : (
              <div className="mb-4 overflow-hidden rounded-md border border-[var(--color-line-soft)]">
                {customer.projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-2 border-b border-[var(--color-line-soft)] px-2.5 py-2.5 text-xs last:border-b-0 hover:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-gray-900">
                      {p.name}
                    </span>
                    <StageBadge code={p.stage} />
                    <b className="text-gray-700">{formatBahtShort(p.value)}</b>
                  </Link>
                ))}
              </div>
            )}

            <div className="mb-1.5 text-xs font-bold text-gray-600">
              {t("recentActivity")}
            </div>
            {customer.activities.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
                {t("noActivity")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {customer.activities.map((a) => (
                  <div key={a.id} className="flex gap-2 text-xs">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
                    <div>
                      <b className="text-gray-900">{a.type}</b> · {a.summary}{" "}
                      <span className="text-gray-400">· {fmtDate(a.occurred_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-dashed border-gray-300 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-gray-300 p-3">
      <div className="mb-2 text-xs font-bold text-gray-600">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5 flex justify-between gap-2 text-xs last:mb-0">
      <span className="text-gray-500">{label}</span>
      <b className="text-right text-gray-700">{value}</b>
    </div>
  );
}
